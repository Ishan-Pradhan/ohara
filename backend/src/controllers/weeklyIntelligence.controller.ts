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
import { computeCourseMetrics } from './classIntelligence.controller.js';
import { resolveCurrentAcademicYearForCourse } from './courses.controller.js';
import { generateJson } from '../services/llm.service.js';
import { weeklySummarySystemPrompt, weeklySummaryUserPrompt } from '../prompts/weeklySummary.prompt.js';
import type { WeeklySummaryContext } from '../prompts/weeklySummary.prompt.js';
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

export const getWeeklySummary = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { courseId } = req.validated?.params as { courseId: string };

    const course = await courseRepository.findById(courseId);
    if (!course) throw new ApiError(404, 'Course not found');

    const { start, end } = getWeekRange();
    const academicYear = await resolveCurrentAcademicYearForCourse(courseId);

    // Enrollment
    const enrollments = await enrollmentRepository.findByCourseWithStudents(courseId);
    const enrollmentCount = enrollments.length;

    // Attendance — fetch sessions in the week range, then count records
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

    // Submissions — fetch all assignments, filter by dueAt in week, count submissions
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

    // Quizzes — fetch all quizzes, filter by createdAt in week, count attempts
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

    // Class metrics (at-risk, average)
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

    // AI insights
    let aiInsights = null;
    try {
      const raw = await generateJson(
        weeklySummarySystemPrompt(),
        weeklySummaryUserPrompt(context),
      );
      aiInsights = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      // AI failure is non-fatal — return deterministic data without insights
    }

    return ok(res, {
      courseId,
      courseName: course.title,
      week: context.weekStart + ' to ' + context.weekEnd,
      enrollmentCount,
      attendance: context.attendance,
      submissions: context.submissions,
      quizzes: context.quizzes,
      atRiskStudents,
      classAverage,
      insights: aiInsights,
    });
  },
);
