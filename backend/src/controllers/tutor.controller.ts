import { randomUUID } from 'node:crypto';
import type { Response } from 'express';
import type { AuthRequest } from '../types/auth.types.js';
import { tutorConversationRepository } from '../repositories/tutorConversations.repository.js';
import { tutorMessageRepository } from '../repositories/tutorMessages.repository.js';
import { moduleRepository } from '../repositories/modules.repository.js';
import { courseRepository } from '../repositories/courses.repository.js';
import { runTutorAgentTurn } from '../agent/tutorAgent.js';
import {
  serializeTutorConversation,
  serializeTutorMessage,
} from '../serializers/tutor.serializer.js';
import { serializeModuleOutline } from '../serializers/courseContent.serializer.js';
import { buildTutorLearningContext } from '../serializers/dashboard.serializer.js';
import { loadStudentPerformanceContext } from './dashboard.controller.js';
import {
  TUTOR_CONVERSATION_STATUSES,
  TUTOR_MESSAGE_ROLES,
  TUTOR_MESSAGE_TYPES,
  DEFAULT_CONVERSATION_TITLE,
  AUTO_TITLE_MAX_LENGTH,
} from '../constants/index.js';
import { asyncHandler } from '../utils/AsyncHandler.js';
import { ok } from '../utils/ApiResponse.js';
import { ApiError } from '../utils/ApiError.js';

// requireEnrolledStudent already guards every route in this file except
// getCourseOutline, which uses requireCourseAccess instead — see
// tutor.routes.ts for why.

/** Shared by the student tutor chat and the study-aids scope picker
 * (StudyAidsPanel), reachable by a student, the course's assigned teacher,
 * or an admin (requireCourseAccess). A student only ever sees a published
 * course's structure; a teacher/admin managing their own (possibly still
 * draft) course needs to see it before publishing. */
export const getCourseOutline = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { courseId } = req.validated?.params as { courseId: string };

  const course = await courseRepository.findById(courseId);
  if (!course) {
    throw new ApiError(404, 'Course not found');
  }
  if (!course.isPublished && req.user!.role === 'student') {
    throw new ApiError(404, 'Course not found');
  }

  const modules = await moduleRepository.findAllByCourse(courseId);
  return ok(res, modules.map(serializeModuleOutline), 'Outline retrieved');
});

export const listConversations = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { courseId } = req.validated?.params as { courseId: string };
  const studentId = req.user!.id;
  const conversations = await tutorConversationRepository.findAllForStudentInCourse(
    studentId,
    courseId,
  );
  return ok(res, conversations.map(serializeTutorConversation), 'Conversations retrieved');
});

export const createConversation = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { courseId } = req.validated?.params as { courseId: string };
  const { title } = req.validated?.body as { title?: string };
  const studentId = req.user!.id;

  const conversation = await tutorConversationRepository.create({
    courseId,
    studentId,
    title: title ?? DEFAULT_CONVERSATION_TITLE,
  });
  return ok(res, serializeTutorConversation(conversation), 'Conversation created', 201);
});

/** A single line derived from the student's first message — same idea as
 * ChatGPT auto-titling a new chat, without a second LLM call for it. */
const deriveTitleFromMessage = (content: string): string => {
  const singleLine = content.replace(/\s+/g, ' ').trim();
  return singleLine.length > AUTO_TITLE_MAX_LENGTH
    ? `${singleLine.slice(0, AUTO_TITLE_MAX_LENGTH).trimEnd()}…`
    : singleLine;
};

const findOwnedConversation = async (conversationId: string, studentId: string, courseId: string) => {
  const conversation = await tutorConversationRepository.findById(conversationId);
  if (!conversation || conversation.studentId !== studentId || conversation.courseId !== courseId) {
    throw new ApiError(404, 'Conversation not found');
  }
  return conversation;
};

export const listMessages = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { courseId, conversationId } = req.validated?.params as {
    courseId: string;
    conversationId: string;
  };
  await findOwnedConversation(conversationId, req.user!.id, courseId);

  const messages = await tutorMessageRepository.findAllByConversation(conversationId);
  return ok(res, messages.map(serializeTutorMessage), 'Messages retrieved');
});

export const deleteConversation = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { courseId, conversationId } = req.validated?.params as {
    courseId: string;
    conversationId: string;
  };
  await findOwnedConversation(conversationId, req.user!.id, courseId);

  await tutorConversationRepository.delete(conversationId);
  return ok(res, null, 'Conversation deleted');
});

/** Only the most recent message in a conversation can be deleted — see
 * tutorMessages.repository.ts's isLatest for why (protects the agent
 * loop's resumable history from a mid-sequence gap). */
export const deleteMessage = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { courseId, conversationId, messageId } = req.validated?.params as {
    courseId: string;
    conversationId: string;
    messageId: string;
  };
  await findOwnedConversation(conversationId, req.user!.id, courseId);

  const message = await tutorMessageRepository.findById(messageId);
  if (!message || message.conversationId !== conversationId) {
    throw new ApiError(404, 'Message not found');
  }

  const isLatest = await tutorMessageRepository.isLatest(conversationId, messageId);
  if (!isLatest) {
    throw new ApiError(400, 'Only the most recent message in a conversation can be deleted');
  }

  await tutorMessageRepository.delete(messageId);
  return ok(res, null, 'Message deleted');
});

export const sendMessage = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { courseId, conversationId } = req.validated?.params as {
    courseId: string;
    conversationId: string;
  };
  const { content } = req.validated?.body as { content: string };
  const studentId = req.user!.id;

  const conversation = await findOwnedConversation(conversationId, studentId, courseId);

  if (conversation.status === TUTOR_CONVERSATION_STATUSES.AWAITING_STUDENT) {
    await tutorConversationRepository.updateStatus(conversationId, TUTOR_CONVERSATION_STATUSES.ACTIVE);
  }

  const userSeq = await tutorMessageRepository.nextSeq(conversationId);
  // seq 0 is always this conversation's very first message — retitle it from
  // that message rather than leaving the "New conversation" placeholder, the
  // same moment ChatGPT titles a new chat from your first prompt.
  if (userSeq === 0 && conversation.title === DEFAULT_CONVERSATION_TITLE) {
    await tutorConversationRepository.updateTitle(conversationId, deriveTitleFromMessage(content));
  }

  const userMessage = await tutorMessageRepository.create({
    conversationId,
    seq: userSeq,
    role: TUTOR_MESSAGE_ROLES.USER,
    type: TUTOR_MESSAGE_TYPES.TEXT,
    content,
  });

  // Build the student's performance learning context to inject into the
  // tutor's system prompt. Failures here must not break the conversation —
  // the tutor functions perfectly without the learning state; it just won't
  // be able to personalise explanations based on the student's performance.
  let learningContext: string | undefined;
  try {
    const performanceCtx = await loadStudentPerformanceContext(studentId);
    const contextText = buildTutorLearningContext(performanceCtx.performance);
    learningContext = contextText ?? undefined;
  } catch {
    // Non-fatal: proceed without learning context
  }

  const result = await runTutorAgentTurn(conversationId, courseId, learningContext);

  // runTutorAgentTurn returns the id of the exact row it persisted for this
  // turn's answer — fetch precisely that row rather than assuming "the last
  // message in the conversation" is this request's own (that assumption
  // breaks under a concurrent double-submit racing tutorMessageRepository's
  // non-atomic nextSeq). messageId is only null in the rare case where
  // persisting the answer itself failed (e.g. a DB blip); there is genuinely
  // no row to fetch then, so the response is built directly from the
  // orchestrator's returned content instead.
  const assistantMessageRow = result.messageId
    ? await tutorMessageRepository.findById(result.messageId)
    : null;

  const assistantMessage = assistantMessageRow
    ? serializeTutorMessage(assistantMessageRow)
    : {
        id: randomUUID(),
        conversationId,
        seq: -1,
        role: TUTOR_MESSAGE_ROLES.ASSISTANT,
        type: TUTOR_MESSAGE_TYPES.TEXT,
        content: result.content,
        toolCalls: null,
        toolResult: null,
        chart: null,
        sources: result.sources,
        createdAt: new Date(),
      };

  return ok(
    res,
    { userMessage: serializeTutorMessage(userMessage), assistantMessage },
    'Message sent',
    201,
  );
});
