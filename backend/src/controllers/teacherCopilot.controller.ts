import type { Response } from 'express';

import type { AuthRequest } from '../types/auth.types.js';
import { copilotRepository } from '../repositories/copilot.repository.js';
import { courseRepository } from '../repositories/courses.repository.js';
import { computeCourseMetrics } from './classIntelligence.controller.js';
import { buildAttendancePercentage } from '../serializers/attendance.serializer.js';
import { attendanceRecordRepository } from '../repositories/attendanceRecords.repository.js';
import { enrollmentRepository } from '../repositories/enrollments.repository.js';
import { assignmentRepository } from '../repositories/assignments.repository.js';
import { submissionRepository } from '../repositories/submissions.repository.js';
import { quizRepository } from '../repositories/quizzes.repository.js';
import { quizAttemptRepository } from '../repositories/quizAttempts.repository.js';
import { resolveCurrentAcademicYearForCourse } from './courses.controller.js';
import { generateText } from '../services/llm.service.js';
import { teacherCopilotSystemPrompt, buildCopilotDataContext } from '../prompts/teacherCopilot.prompt.js';
import { asyncHandler } from '../utils/AsyncHandler.js';
import { ok } from '../utils/ApiResponse.js';
import { ApiError } from '../utils/ApiError.js';

/** Build the deterministic data context for the copilot. */
const buildCopilotData = async (courseId: string) => {
  const academicYear = await resolveCurrentAcademicYearForCourse(courseId);
  const [metrics, roster, byStudentAttendance, assignments] = await Promise.all([
    computeCourseMetrics(courseId),
    enrollmentRepository.findByCourseWithStudents(courseId),
    attendanceRecordRepository.countByStatusForCourse(courseId),
    assignmentRepository.findAllByCourse(courseId, academicYear.id),
  ]);

  const averages = metrics.filter((m) => m.averageGrade !== null).map((m) => m.averageGrade as number);
  const classAverage = averages.length > 0 ? averages.reduce((a, b) => a + b, 0) / averages.length : null;

  const attendancePercentages = roster
    .map(({ studentId }) => buildAttendancePercentage(byStudentAttendance[studentId] ?? []).percentage)
    .filter((p): p is number => p !== null);
  const attendanceRate = attendancePercentages.length > 0
    ? attendancePercentages.reduce((a, b) => a + b, 0) / attendancePercentages.length
    : null;

  const now = new Date();
  const pastDueAssignments = assignments.filter((a) => a.dueAt < now);
  let submissionCompletionRate: number | null = null;
  if (pastDueAssignments.length > 0 && roster.length > 0) {
    const subsByAssignment = await Promise.all(
      pastDueAssignments.map((a) => submissionRepository.findAllByAssignment(a.id)),
    );
    let totalRequired = 0;
    let totalSubmitted = 0;
    subsByAssignment.forEach((subs) => {
      totalRequired += roster.length;
      totalSubmitted += subs.length;
    });
    submissionCompletionRate = totalRequired > 0 ? (totalSubmitted / totalRequired) * 100 : null;
  }

  const atRiskCount = metrics.filter((m) => m.isAtRisk).length;

  // Recent quiz summaries
  const quizzes = await quizRepository.findAllByCourse(courseId, academicYear.id);
  const recentQuizSummaries = quizzes.length > 0
    ? (await Promise.all(
        quizzes.slice(-3).map(async (quiz) => {
          const attempts = await quizAttemptRepository.findAllByQuiz(quiz.id);
          const scores = attempts.map((a) => a.maxScore > 0 ? Math.round((a.score / a.maxScore) * 100) : 0);
          const avg = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
          return `${quiz.title}: avg ${avg.toFixed(0)}% (${attempts.length} attempts)`;
        }),
      )).join('; ')
    : 'no quizzes yet';

  // Recent submission summaries
  const recentSubmissionSummaries = assignments.length > 0
    ? (await Promise.all(
        assignments.slice(-3).map(async (assignment) => {
          const subs = await submissionRepository.findAllByAssignment(assignment.id);
          return `${assignment.title}: ${subs.length} submissions`;
        }),
      )).join('; ')
    : 'no assignments yet';

  return {
    courseName: (await courseRepository.findById(courseId))?.title ?? 'this course',
    classAverage,
    attendanceRate,
    submissionCompletionRate,
    atRiskCount,
    enrollmentCount: roster.length,
    studentMetrics: metrics.map((m) => ({
      studentName: m.studentName,
      averageGrade: m.averageGrade,
      attendancePercentage: m.attendancePercentage,
      missingSubmissions: m.missingSubmissions,
      lateSubmissions: m.lateSubmissions,
      isAtRisk: m.isAtRisk,
    })),
    recentQuizSummaries,
    recentSubmissionSummaries,
  };
};

export const createCopilotConversation = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { courseId } = req.validated?.params as { courseId: string };
    const teacherId = req.user?.id;
    if (!teacherId) throw new ApiError(401, 'Unauthorized');

    const conversation = await copilotRepository.createConversation(courseId, teacherId);
    return ok(res, conversation.toJSON(), 'Conversation created', 201);
  },
);

export const getCopilotConversations = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { courseId } = req.validated?.params as { courseId: string };
    const teacherId = req.user?.id;
    if (!teacherId) throw new ApiError(401, 'Unauthorized');

    const conversations = await copilotRepository.findTeacherConversations(courseId, teacherId);
    return ok(res, conversations.map((c) => c.toJSON()), 'Conversations retrieved');
  },
);

export const getCopilotConversation = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { conversationId } = req.validated?.params as { conversationId: string };
    const teacherId = req.user?.id;
    if (!teacherId) throw new ApiError(401, 'Unauthorized');

    const conversation = await copilotRepository.findConversationWithMessages(conversationId);
    if (!conversation) {
      throw new ApiError(404, 'Conversation not found');
    }
    if (conversation.teacherId !== teacherId && req.user?.role !== 'admin') {
      throw new ApiError(403, 'Access denied');
    }

    return ok(res, conversation.toJSON(), 'Conversation retrieved');
  },
);

export const sendCopilotMessage = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { conversationId } = req.validated?.params as { conversationId: string };
    const { message } = req.validated?.body as { message: string };
    const teacherId = req.user?.id;
    if (!teacherId) throw new ApiError(401, 'Unauthorized');

    const conversation = await copilotRepository.findConversation(conversationId);
    if (!conversation) {
      throw new ApiError(404, 'Conversation not found');
    }
    if (conversation.teacherId !== teacherId) {
      throw new ApiError(403, 'Access denied');
    }

    const nextSeq = (await copilotRepository.getMaxSeq(conversationId)) + 1;

    // Save user message
    const userMessage = await copilotRepository.createMessage(
      conversationId,
      nextSeq,
      'user',
      message,
    );

    // Build data context
    const dataContext = await buildCopilotData(conversation.courseId);

    // Update title from first message if still default
    if (conversation.title === 'New conversation') {
      const title = message.length > 60 ? message.slice(0, 57) + '...' : message;
      await conversation.update({ title });
    }

    // Generate AI response
    const systemPrompt = teacherCopilotSystemPrompt;
    const userPrompt = `${buildCopilotDataContext(dataContext)}\n\nTeacher's question: ${message}`;

    let assistantContent: string;
    try {
      assistantContent = await generateText(systemPrompt, userPrompt);
    } catch {
      assistantContent = 'I was unable to generate a response. Please try again.';
    }

    // Save assistant message
    const assistantMessage = await copilotRepository.createMessage(
      conversationId,
      nextSeq + 1,
      'assistant',
      assistantContent.trim(),
      dataContext as unknown as Record<string, unknown>,
    );

    return ok(res, { userMessage: userMessage.toJSON(), assistantMessage: assistantMessage.toJSON() }, 'Message sent');
  },
);

export const deleteCopilotConversation = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { conversationId } = req.validated?.params as { conversationId: string };
    const teacherId = req.user?.id;
    if (!teacherId) throw new ApiError(401, 'Unauthorized');

    const conversation = await copilotRepository.findConversation(conversationId);
    if (!conversation) {
      throw new ApiError(404, 'Conversation not found');
    }
    if (conversation.teacherId !== teacherId && req.user?.role !== 'admin') {
      throw new ApiError(403, 'Access denied');
    }

    await copilotRepository.deleteConversation(conversationId);
    return ok(res, null, 'Conversation deleted');
  },
);
