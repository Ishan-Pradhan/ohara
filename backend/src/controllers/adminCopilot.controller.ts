import type { Response } from 'express';

import type { AuthRequest } from '../types/auth.types.js';
import { programRepository } from '../repositories/programs.repository.js';
import { classRepository } from '../repositories/classes.repository.js';
import { courseRepository } from '../repositories/courses.repository.js';
import { userRepository } from '../repositories/users.repository.js';
import { interventionRepository } from '../repositories/intervention.repository.js';
import { adminCopilotRepository } from '../repositories/adminCopilot.repository.js';
import { computeCourseMetrics } from './classIntelligence.controller.js';
import { generateText } from '../services/llm.service.js';
import { adminCopilotSystemPrompt, adminCopilotUserPrompt } from '../prompts/adminCopilot.prompt.js';
import { formatCopilotHistory } from '../utils/copilotHistory.js';
import { asyncHandler } from '../utils/AsyncHandler.js';
import { ok } from '../utils/ApiResponse.js';
import { ApiError } from '../utils/ApiError.js';
import { USER_ROLES } from '../constants/index.js';

/** The deterministic data context every question is grounded in — built
 * fresh per message, since institution data can change between messages
 * in the same conversation. */
async function buildAdminDataContext(): Promise<string> {
  const [programs, classes, allCourses, allStudents, allTeachers] = await Promise.all([
    programRepository.findAll(),
    classRepository.findAll(),
    courseRepository.findAll(),
    userRepository.findAll({ role: USER_ROLES.STUDENT }),
    userRepository.findAll({ role: USER_ROLES.TEACHER }),
  ]);

  // Compute per-course metrics (limit to first 20 for context size)
  const courseSummaries: string[] = [];
  const coursesToProcess = allCourses.slice(0, 20);
  for (const course of coursesToProcess) {
    try {
      const metrics = await computeCourseMetrics(course.id);
      const atRisk = metrics.filter((m) => m.isAtRisk);
      const avg = metrics.length > 0
        ? metrics.reduce((s, m) => s + (m.averageGrade ?? 0), 0) / metrics.length
        : null;
      const att = metrics.length > 0
        ? metrics.reduce((s, m) => s + (m.attendancePercentage ?? 0), 0) / metrics.length
        : null;

      const programName = programs.find((p) => {
        const cls = classes.find((c) => c.id === course.classId);
        return cls?.programId === p.id;
      })?.name ?? 'Unknown';

      courseSummaries.push(
        `- ${course.title} (${programName}): ${metrics.length} students, avg ${avg !== null ? `${avg.toFixed(1)}%` : 'N/A'}, attendance ${att !== null ? `${att.toFixed(1)}%` : 'N/A'}, ${atRisk.length} at-risk${atRisk.length > 0 ? ` (${atRisk.map((m) => m.studentName).join(', ')})` : ''}`,
      );
    } catch {
      // Skip
    }
  }

  // Active interventions
  const activeInterventions: string[] = [];
  for (const course of coursesToProcess.slice(0, 10)) {
    try {
      const interventions = await interventionRepository.findByCourse(course.id);
      const active = interventions.filter((i) => i.status === 'active');
      for (const inv of active) {
        activeInterventions.push(`- ${course.title}: ${inv.title} (${inv.type})`);
      }
    } catch {
      // Skip
    }
  }

  const lines = [
    `Institution: ${allStudents.length} students, ${allTeachers.length} teachers, ${allCourses.length} courses, ${programs.length} programs`,
    '',
    'Courses:',
    ...courseSummaries,
  ];

  if (activeInterventions.length > 0) {
    lines.push('', 'Active interventions:', ...activeInterventions);
  }

  return lines.join('\n');
}

export const createCopilotConversation = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const adminId = req.user?.id;
    if (!adminId) throw new ApiError(401, 'Unauthorized');

    const conversation = await adminCopilotRepository.createConversation(adminId);
    return ok(res, conversation.toJSON(), 'Conversation created', 201);
  },
);

export const getCopilotConversations = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const adminId = req.user?.id;
    if (!adminId) throw new ApiError(401, 'Unauthorized');

    const conversations = await adminCopilotRepository.findAdminConversations(adminId);
    return ok(res, conversations.map((c) => c.toJSON()), 'Conversations retrieved');
  },
);

export const getCopilotConversation = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { conversationId } = req.validated?.params as { conversationId: string };
    const adminId = req.user?.id;
    if (!adminId) throw new ApiError(401, 'Unauthorized');

    const conversation = await adminCopilotRepository.findConversationWithMessages(conversationId);
    if (!conversation) {
      throw new ApiError(404, 'Conversation not found');
    }
    if (conversation.adminId !== adminId) {
      throw new ApiError(403, 'Access denied');
    }

    return ok(res, conversation.toJSON(), 'Conversation retrieved');
  },
);

export const sendCopilotMessage = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { conversationId } = req.validated?.params as { conversationId: string };
    const { message } = req.validated?.body as { message: string };
    const adminId = req.user?.id;
    if (!adminId) throw new ApiError(401, 'Unauthorized');

    const conversation = await adminCopilotRepository.findConversation(conversationId);
    if (!conversation) {
      throw new ApiError(404, 'Conversation not found');
    }
    if (conversation.adminId !== adminId) {
      throw new ApiError(403, 'Access denied');
    }

    // Last 2 exchanges (4 messages), fetched before this turn's messages
    // exist so it's genuinely "what came before", not including itself.
    const priorMessages = await adminCopilotRepository.findRecentMessages(conversationId, 4);
    const history = formatCopilotHistory(
      priorMessages.map((m) => ({ role: m.role, content: m.content })),
    );

    const nextSeq = (await adminCopilotRepository.getMaxSeq(conversationId)) + 1;

    const userMessage = await adminCopilotRepository.createMessage(
      conversationId,
      nextSeq,
      'user',
      message,
    );

    const dataContext = await buildAdminDataContext();

    if (conversation.title === 'New conversation') {
      const title = message.length > 60 ? message.slice(0, 57) + '...' : message;
      await conversation.update({ title });
    }

    let assistantContent: string;
    try {
      assistantContent = await generateText(
        adminCopilotSystemPrompt(),
        adminCopilotUserPrompt(message, dataContext, history),
      );
    } catch {
      assistantContent = 'I was unable to generate a response. Please try again.';
    }

    const assistantMessage = await adminCopilotRepository.createMessage(
      conversationId,
      nextSeq + 1,
      'assistant',
      assistantContent.trim(),
      { dataContext },
    );

    return ok(res, { userMessage: userMessage.toJSON(), assistantMessage: assistantMessage.toJSON() }, 'Message sent');
  },
);

export const deleteCopilotConversation = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { conversationId } = req.validated?.params as { conversationId: string };
    const adminId = req.user?.id;
    if (!adminId) throw new ApiError(401, 'Unauthorized');

    const conversation = await adminCopilotRepository.findConversation(conversationId);
    if (!conversation) {
      throw new ApiError(404, 'Conversation not found');
    }
    if (conversation.adminId !== adminId) {
      throw new ApiError(403, 'Access denied');
    }

    await adminCopilotRepository.deleteConversation(conversationId);
    return ok(res, null, 'Conversation deleted');
  },
);
