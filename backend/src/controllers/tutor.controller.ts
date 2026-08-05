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
import {
  TUTOR_CONVERSATION_STATUSES,
  TUTOR_MESSAGE_ROLES,
  TUTOR_MESSAGE_TYPES,
} from '../constants/index.js';
import { asyncHandler } from '../utils/AsyncHandler.js';
import { ok } from '../utils/ApiResponse.js';
import { ApiError } from '../utils/ApiError.js';

// requireEnrolledStudent already guards every route in this file.

export const getCourseOutline = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { courseId } = req.validated?.params as { courseId: string };

  const course = await courseRepository.findById(courseId);
  if (!course || !course.isPublished) {
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
  const { title } = req.validated?.body as { title: string };
  const studentId = req.user!.id;

  const conversation = await tutorConversationRepository.create({ courseId, studentId, title });
  return ok(res, serializeTutorConversation(conversation), 'Conversation created', 201);
});

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
  const userMessage = await tutorMessageRepository.create({
    conversationId,
    seq: userSeq,
    role: TUTOR_MESSAGE_ROLES.USER,
    type: TUTOR_MESSAGE_TYPES.TEXT,
    content,
  });

  const result = await runTutorAgentTurn(conversationId, courseId);

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
