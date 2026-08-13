import type { Response } from 'express';

import type { AuthRequest } from '../types/auth.types.js';
import { enrollmentRepository } from '../repositories/enrollments.repository.js';
import { attendanceSessionRepository } from '../repositories/attendanceSessions.repository.js';
import { attendanceRecordRepository } from '../repositories/attendanceRecords.repository.js';
import { assignmentRepository } from '../repositories/assignments.repository.js';
import { submissionRepository } from '../repositories/submissions.repository.js';
import { quizRepository } from '../repositories/quizzes.repository.js';
import { quizAttemptRepository } from '../repositories/quizAttempts.repository.js';
import { courseRepository } from '../repositories/courses.repository.js';
import { courseWeeklyInsightRepository } from '../repositories/courseWeeklyInsight.repository.js';
import { computeCourseMetrics } from './classIntelligence.controller.js';
import { resolveCurrentAcademicYearForCourse } from './courses.controller.js';
import { generateJson } from '../services/llm.service.js';
import { weeklySummarySystemPrompt, weeklySummaryUserPrompt } from '../prompts/weeklySummary.prompt.js';
import type { WeeklySummaryContext } from '../prompts/weeklySummary.prompt.js';
import { weeklyInsightsSchema } from '../validations/weeklyIntelligence.validation.js';
import { asyncHandler } from '../utils/AsyncHandler.js';
import { ok } from '../utils/ApiResponse.js';
import { ApiError } from '../utils/ApiError.js';

function getWeekRange(): { start: Date; end: Date; label: string } {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((dayOfWeek + 6) % 7));
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);

  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return { start: monday, end: sunday, label: `${fmt(monday)} to ${fmt(sunday)}` };
}

/** The non-AI half of the page: every deterministic this-week metric for one
 * course. Shared by the GET (fast, no LLM) and the insights-generation
 * endpoint (needs the same data to build the prompt). */
const loadWeeklySummaryData = async (
  courseId: string,
): Promise<{ courseName: string; weekStart: string; context: WeeklySummaryContext }> => {
  const course = await courseRepository.findById(courseId);
  if (!course) throw new ApiError(404, 'Course not found');

  const { start, end } = getWeekRange();
  const academicYear = await resolveCurrentAcademicYearForCourse(courseId);

  const enrollments = await enrollmentRepository.findByCourseWithStudents(courseId);
  const enrollmentCount = enrollments.length;

  const allSessions = await attendanceSessionRepository.findAllByCourse(courseId);
  const weekSessions = allSessions.filter((s) => {
    const d = new Date(s.sessionDate);
    return d >= start && d <= end;
  });

  let present = 0;
  let absent = 0;
  let late = 0;
  for (const session of weekSessions) {
    const records = await attendanceRecordRepository.findBySession(session.id);
    for (const r of records) {
      if (r.status === 'present') present++;
      else if (r.status === 'absent') absent++;
      else if (r.status === 'late') late++;
    }
  }
  const totalAttendanceRecords = present + absent + late;
  const attendanceRate = totalAttendanceRecords > 0
    ? ((present + late) / totalAttendanceRecords) * 100
    : null;

  const assignments = await assignmentRepository.findAllByCourse(courseId, academicYear.id);
  const weekAssignments = assignments.filter((a) => {
    const d = new Date(a.dueAt);
    return d >= start && d <= end;
  });

  let submitted = 0;
  let lateSubs = 0;
  let notSubmitted = 0;
  for (const assignment of weekAssignments) {
    const subs = await submissionRepository.findAllByAssignment(assignment.id);
    submitted += subs.length;
    lateSubs += subs.filter((s) => s.isLate).length;
    notSubmitted += Math.max(0, enrollmentCount - subs.length);
  }

  const quizzes = await quizRepository.findAllByCourse(courseId, academicYear.id);
  const weekQuizzes = quizzes.filter((q) => {
    const d = new Date(q.createdAt);
    return d >= start && d <= end;
  });

  let quizAttempted = 0;
  let totalQuizScore = 0;
  let quizScoreCount = 0;
  for (const quiz of weekQuizzes) {
    const attempts = await quizAttemptRepository.findAllByQuiz(quiz.id);
    quizAttempted += attempts.length;
    for (const a of attempts) {
      totalQuizScore += a.maxScore > 0 ? (a.score / a.maxScore) * 100 : 0;
      quizScoreCount++;
    }
  }
  const averageQuizScore = quizScoreCount > 0 ? totalQuizScore / quizScoreCount : null;

  const metrics = await computeCourseMetrics(courseId);
  const atRiskStudents = metrics
    .filter((m) => m.isAtRisk)
    .map((m) => ({
      name: m.studentName,
      average: m.averageGrade,
      attendance: m.attendancePercentage,
      missingSubmissions: m.missingSubmissions,
    }));
  const classAverage = metrics.length > 0
    ? metrics.reduce((sum, m) => sum + (m.averageGrade ?? 0), 0) / metrics.length
    : null;

  const context: WeeklySummaryContext = {
    courseName: course.title,
    weekStart: start.toISOString().slice(0, 10),
    weekEnd: end.toISOString().slice(0, 10),
    enrollmentCount,
    attendance: {
      sessions: weekSessions.length,
      present,
      absent,
      late,
      attendanceRate,
    },
    submissions: {
      total: weekAssignments.length * enrollmentCount,
      submitted,
      late: lateSubs,
      onTime: submitted - lateSubs,
      notSubmitted,
    },
    quizzes: {
      total: weekQuizzes.length,
      attempted: quizAttempted,
      averageScore: averageQuizScore,
    },
    atRiskStudents,
    classAverage,
  };

  return { courseName: course.title, weekStart: context.weekStart, context };
};

/** Fast — deterministic metrics only, plus whatever insights are already
 * cached for this course (or null if never generated). Never calls the LLM. */
export const getWeeklySummary = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { courseId } = req.validated?.params as { courseId: string };

    const { courseName, context } = await loadWeeklySummaryData(courseId);
    const cached = await courseWeeklyInsightRepository.findByCourse(courseId);

    return ok(res, {
      courseId,
      courseName,
      week: `${context.weekStart} to ${context.weekEnd}`,
      enrollmentCount: context.enrollmentCount,
      attendance: context.attendance,
      submissions: context.submissions,
      quizzes: context.quizzes,
      atRiskStudents: context.atRiskStudents,
      classAverage: context.classAverage,
      insights: cached?.content ?? null,
      insightsGeneratedAt: cached?.generatedAt.toISOString() ?? null,
    });
  },
);

/** Teacher-triggered only — never automatic. Recomputes this course's week
 * data fresh and replaces the cached row for this course. */
export const generateWeeklySummaryInsights = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { courseId } = req.validated?.params as { courseId: string };

    const { weekStart, context } = await loadWeeklySummaryData(courseId);

    const systemPrompt = weeklySummarySystemPrompt();
    const userPrompt = weeklySummaryUserPrompt(context);

    let insights;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const raw = await generateJson(systemPrompt, userPrompt);
        insights = weeklyInsightsSchema.parse(JSON.parse(raw));
        break;
      } catch {
        if (attempt === 1) throw new ApiError(502, 'The LLM could not produce valid insights after a retry');
      }
    }
    if (!insights) throw new ApiError(502, 'The LLM could not produce valid insights after a retry');

    const saved = await courseWeeklyInsightRepository.upsert(courseId, weekStart, insights);

    return ok(
      res,
      { insights: saved.content, generatedAt: saved.generatedAt.toISOString() },
      'Insights generated',
    );
  },
);
