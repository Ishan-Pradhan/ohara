import type { Response } from 'express';

import type { AuthRequest } from '../types/auth.types.js';
import { programRepository } from '../repositories/programs.repository.js';
import { classRepository } from '../repositories/classes.repository.js';
import { courseRepository } from '../repositories/courses.repository.js';
import { attendanceSessionRepository } from '../repositories/attendanceSessions.repository.js';
import { attendanceRecordRepository } from '../repositories/attendanceRecords.repository.js';
import { assignmentRepository } from '../repositories/assignments.repository.js';
import { submissionRepository } from '../repositories/submissions.repository.js';
import { quizRepository } from '../repositories/quizzes.repository.js';
import { quizAttemptRepository } from '../repositories/quizAttempts.repository.js';
import { enrollmentRepository } from '../repositories/enrollments.repository.js';
import { institutionWeeklyInsightRepository } from '../repositories/institutionWeeklyInsight.repository.js';
import { computeCourseMetrics } from './classIntelligence.controller.js';
import { resolveCurrentAcademicYearForCourse } from './courses.controller.js';
import { generateJson } from '../services/llm.service.js';
import { institutionWeeklySystemPrompt, institutionWeeklyUserPrompt } from '../prompts/institutionWeekly.prompt.js';
import type { InstitutionWeeklyContext } from '../prompts/institutionWeekly.prompt.js';
import { institutionWeeklyInsightsSchema } from '../validations/institutionWeekly.validation.js';
import { asyncHandler } from '../utils/AsyncHandler.js';
import { ok } from '../utils/ApiResponse.js';
import { ApiError } from '../utils/ApiError.js';

/** Institution-wide aggregation spans every course, some of which may not
 * have a current academic year configured yet for their term (e.g. a
 * freshly created program) — that's a per-course setup gap, not something
 * that should break the whole weekly summary, so it's skipped rather than
 * thrown. Single-course endpoints use resolveCurrentAcademicYearForCourse
 * directly and let that 400 reach the caller, since there it's actionable. */
const resolveCurrentAcademicYearIdOrNull = async (courseId: string): Promise<string | null> => {
  try {
    const academicYear = await resolveCurrentAcademicYearForCourse(courseId);
    return academicYear.id;
  } catch {
    return null;
  }
};

function getWeekRange(): { start: Date; end: Date } {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((dayOfWeek + 6) % 7));
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  return { start: monday, end: sunday };
}

/** The non-AI half of the page: every deterministic this-week metric across
 * the institution. Shared by the GET (fast, no LLM) and the
 * insights-generation endpoint (needs the same data to build the prompt). */
const loadInstitutionWeeklyData = async (): Promise<InstitutionWeeklyContext> => {
  const { start, end } = getWeekRange();
  const fmt = (d: Date) => d.toISOString().slice(0, 10);

  const [programs, classes, allCourses] = await Promise.all([
    programRepository.findAll(),
    classRepository.findAll(),
    courseRepository.findAll(),
  ]);

  // Attendance this week
  let totalPresent = 0;
  let totalAbsent = 0;
  let totalLate = 0;
  let totalSessions = 0;
  for (const course of allCourses) {
    const sessions = await attendanceSessionRepository.findAllByCourse(course.id);
    const weekSessions = sessions.filter((s) => {
      const d = new Date(s.sessionDate);
      return d >= start && d <= end;
    });
    totalSessions += weekSessions.length;
    for (const session of weekSessions) {
      const records = await attendanceRecordRepository.findBySession(session.id);
      for (const r of records) {
        if (r.status === 'present') totalPresent++;
        else if (r.status === 'absent') totalAbsent++;
        else if (r.status === 'late') totalLate++;
      }
    }
  }
  const totalAttendanceRecords = totalPresent + totalAbsent + totalLate;
  const attendanceRate = totalAttendanceRecords > 0
    ? ((totalPresent + totalLate) / totalAttendanceRecords) * 100
    : null;

  // Submissions this week
  let totalDue = 0;
  let totalSubmitted = 0;
  let totalLateSubs = 0;
  let totalMissing = 0;
  for (const course of allCourses) {
    const academicYearId = await resolveCurrentAcademicYearIdOrNull(course.id);
    if (!academicYearId) continue;
    const assignments = await assignmentRepository.findAllByCourse(course.id, academicYearId);
    const weekAssignments = assignments.filter((a) => {
      const d = new Date(a.dueAt);
      return d >= start && d <= end;
    });
    const enrollments = await enrollmentRepository.findByCourseWithStudents(course.id);
    const studentCount = enrollments.length;
    for (const assignment of weekAssignments) {
      const subs = await submissionRepository.findAllByAssignment(assignment.id);
      totalDue += studentCount;
      totalSubmitted += subs.length;
      totalLateSubs += subs.filter((s) => s.isLate).length;
      totalMissing += Math.max(0, studentCount - subs.length);
    }
  }

  // Quizzes this week
  let totalQuizAttempts = 0;
  let totalQuizScore = 0;
  let quizScoreCount = 0;
  let totalQuizAvailable = 0;
  for (const course of allCourses) {
    const academicYearId = await resolveCurrentAcademicYearIdOrNull(course.id);
    if (!academicYearId) continue;
    const quizzes = await quizRepository.findAllByCourse(course.id, academicYearId);
    const weekQuizzes = quizzes.filter((q) => {
      const d = new Date(q.createdAt);
      return d >= start && d <= end;
    });
    totalQuizAvailable += weekQuizzes.length;
    for (const quiz of weekQuizzes) {
      const attempts = await quizAttemptRepository.findAllByQuiz(quiz.id);
      totalQuizAttempts += attempts.length;
      for (const a of attempts) {
        totalQuizScore += a.maxScore > 0 ? (a.score / a.maxScore) * 100 : 0;
        quizScoreCount++;
      }
    }
  }

  // Program summaries
  const programMap = new Map<string, { name: string; totalAvg: number; avgCount: number; totalAtt: number; attCount: number; atRisk: number }>();
  for (const course of allCourses) {
    try {
      const metrics = await computeCourseMetrics(course.id);
      const programName = programs.find((p) => {
        const cls = classes.find((c) => c.id === course.classId);
        return cls?.programId === p.id;
      })?.name ?? 'Unknown';

      const existing = programMap.get(programName) ?? { name: programName, totalAvg: 0, avgCount: 0, totalAtt: 0, attCount: 0, atRisk: 0 };
      for (const m of metrics) {
        if (m.averageGrade !== null) { existing.totalAvg += m.averageGrade; existing.avgCount++; }
        if (m.attendancePercentage !== null) { existing.totalAtt += m.attendancePercentage; existing.attCount++; }
        if (m.isAtRisk) existing.atRisk++;
      }
      programMap.set(programName, existing);
    } catch {
      // Skip
    }
  }

  const programSummaries = Array.from(programMap.values()).map((p) => ({
    name: p.name,
    averageGrade: p.avgCount > 0 ? p.totalAvg / p.avgCount : null,
    attendanceRate: p.attCount > 0 ? p.totalAtt / p.attCount : null,
    atRiskCount: p.atRisk,
  }));

  const totalAtRisk = programSummaries.reduce((s, p) => s + p.atRiskCount, 0);

  return {
    weekStart: fmt(start),
    weekEnd: fmt(end),
    totals: {
      activeCourses: allCourses.length,
      totalStudents: 0,
      totalAtRisk,
    },
    attendance: {
      sessionsThisWeek: totalSessions,
      present: totalPresent,
      absent: totalAbsent,
      late: totalLate,
      rate: attendanceRate,
    },
    submissions: {
      dueThisWeek: totalDue,
      submitted: totalSubmitted,
      late: totalLateSubs,
      missing: totalMissing,
    },
    quizzes: {
      availableThisWeek: totalQuizAvailable,
      attempts: totalQuizAttempts,
      averageScore: quizScoreCount > 0 ? totalQuizScore / quizScoreCount : null,
    },
    programSummaries,
  };
};

/** Fast — deterministic metrics only, plus whatever insights are already
 * cached (or null if never generated). Never calls the LLM. */
export const getInstitutionWeekly = asyncHandler(
  async (_req: AuthRequest, res: Response) => {
    const context = await loadInstitutionWeeklyData();
    const cached = await institutionWeeklyInsightRepository.find();

    return ok(res, {
      week: `${context.weekStart} to ${context.weekEnd}`,
      totals: context.totals,
      attendance: context.attendance,
      submissions: context.submissions,
      quizzes: context.quizzes,
      programSummaries: context.programSummaries,
      insights: cached?.content ?? null,
      insightsGeneratedAt: cached?.generatedAt.toISOString() ?? null,
    });
  },
);

/** Admin-triggered only — never automatic. Recomputes this week's data
 * fresh and replaces the single cached row. */
export const generateInstitutionWeeklyInsights = asyncHandler(
  async (_req: AuthRequest, res: Response) => {
    const context = await loadInstitutionWeeklyData();

    const systemPrompt = institutionWeeklySystemPrompt();
    const userPrompt = institutionWeeklyUserPrompt(context);

    let insights;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const raw = await generateJson(systemPrompt, userPrompt);
        insights = institutionWeeklyInsightsSchema.parse(JSON.parse(raw));
        break;
      } catch {
        if (attempt === 1) throw new ApiError(502, 'The LLM could not produce valid insights after a retry');
      }
    }
    if (!insights) throw new ApiError(502, 'The LLM could not produce valid insights after a retry');

    const saved = await institutionWeeklyInsightRepository.upsert(context.weekStart, insights);

    return ok(
      res,
      { insights: saved.content, generatedAt: saved.generatedAt.toISOString() },
      'Insights generated',
    );
  },
);
