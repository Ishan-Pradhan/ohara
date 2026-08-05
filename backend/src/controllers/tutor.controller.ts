import type { Response } from 'express';
import type { AuthRequest } from '../types/auth.types.js';
import { tutorConversationRepository } from '../repositories/tutorConversations.repository.js';
import { tutorMessageRepository } from '../repositories/tutorMessages.repository.js';
import { documentChunkRepository } from '../repositories/documentChunks.repository.js';
import { moduleRepository } from '../repositories/modules.repository.js';
import { courseRepository } from '../repositories/courses.repository.js';
import { embed } from '../services/embeddings.service.js';
import { generateText } from '../services/llm.service.js';
import { tutorStage1SystemPrompt, tutorStage1UserPrompt } from '../prompts/tutorStage1.prompt.js';
import {
  serializeTutorConversation,
  serializeTutorMessage,
} from '../serializers/tutor.serializer.js';
import { serializeModuleOutline } from '../serializers/courseContent.serializer.js';
import { TUTOR_RETRIEVAL_K, TUTOR_MESSAGE_ROLES, TUTOR_MESSAGE_TYPES } from '../constants/index.js';
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

  await findOwnedConversation(conversationId, studentId, courseId);

  const userSeq = await tutorMessageRepository.nextSeq(conversationId);
  const userMessage = await tutorMessageRepository.create({
    conversationId,
    seq: userSeq,
    role: TUTOR_MESSAGE_ROLES.USER,
    type: TUTOR_MESSAGE_TYPES.TEXT,
    content,
  });

  const [queryVector] = await embed([content]);
  if (!queryVector) {
    throw new ApiError(500, 'Failed to generate an embedding for the question');
  }
  const chunks = await documentChunkRepository.findSimilar(courseId, queryVector, TUTOR_RETRIEVAL_K);

  // Sources are exactly the chunks we retrieved and sent — never parsed
  // from the model's own claims about what it used.
  const sources = await Promise.all(
    chunks.map(async (chunk) => {
      const document = chunk.document ?? (await chunk.$get('document'));
      return {
        documentId: chunk.documentId,
        filename: document?.filename ?? 'Unknown document',
        chunkContent: chunk.content,
      };
    }),
  );

  // Grounding is mandatory: zero retrieved chunks must never reach the LLM.
  // Relying on the prompt's own "no material" framing to make the model
  // refuse is not a mechanical guarantee — nothing stops it from answering
  // anyway (including via a crafted question acting as a prompt injection).
  // So this is a hard branch, not a prompt-engineering nudge.
  let answerText: string;
  if (chunks.length === 0) {
    answerText = "There's no course material available yet to answer this question.";
  } else {
    const userPrompt = tutorStage1UserPrompt(
      content,
      sources.map((s) => ({ filename: s.filename, content: s.chunkContent })),
    );
    answerText = await generateText(tutorStage1SystemPrompt, userPrompt);
  }

  const assistantSeq = await tutorMessageRepository.nextSeq(conversationId);
  const assistantMessage = await tutorMessageRepository.create({
    conversationId,
    seq: assistantSeq,
    role: TUTOR_MESSAGE_ROLES.ASSISTANT,
    type: TUTOR_MESSAGE_TYPES.TEXT,
    content: answerText,
    sources: chunks.length > 0 ? sources : null,
  });

  return ok(
    res,
    { userMessage: serializeTutorMessage(userMessage), assistantMessage: serializeTutorMessage(assistantMessage) },
    'Message sent',
    201,
  );
});
