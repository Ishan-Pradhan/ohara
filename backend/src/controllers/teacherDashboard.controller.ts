import type { Response } from 'express';

import type { AuthRequest } from '../types/auth.types.js';
import { courseTeacherRepository } from '../repositories/courseTeachers.repository.js';
import { teacherDashboardInsightRepository } from '../repositories/teacherDashboardInsight.repository.js';
import { computeCourseMetrics } from './classIntelligence.controller.js';
import { generateJson } from '../services/llm.service.js';
import {
  teacherDashboardInsightsSystemPrompt,
  teacherDashboardInsightsUserPrompt,
} from '../prompts/teacherDashboardInsights.prompt.js';
import type { DashboardInsightsContext } from '../prompts/teacherDashboardInsights.prompt.js';
import { dashboardInsightsSchema } from '../validations/teacherDashboard.validation.js';
import { asyncHandler } from '../utils/AsyncHandler.js';
import { ok } from '../utils/ApiResponse.js';
import { ApiError } from '../utils/ApiError.js';

/** The non-AI half of the dashboard: every course the teacher is assigned
 * to, with deterministic metrics. Shared by the GET (fast, no LLM) and the
 * insights-generation endpoint (needs the same data to build the prompt). */
const loadTeacherCourseSummaries = async (teacherId: string) => {
  const assignments = await courseTeacherRepository.findByTeacherId(teacherId);

  const courses = [];
  let totalStudents = 0;
  let totalAtRisk = 0;

  for (const assignment of assignments) {
    const courseId = assignment.courseId;
    const metrics = await computeCourseMetrics(courseId);

    const enrollmentCount = metrics.length;
    const atRiskCount = metrics.filter((m) => m.isAtRisk).length;
    const classAverage =
      metrics.length > 0
        ? metrics.reduce((sum, m) => sum + (m.averageGrade ?? 0), 0) / metrics.length
        : null;
    const attendanceRate =
      metrics.length > 0
        ? metrics.reduce((sum, m) => sum + (m.attendancePercentage ?? 0), 0) / metrics.length
        : null;

    totalStudents += enrollmentCount;
    totalAtRisk += atRiskCount;

    courses.push({
      courseId,
      courseName: assignment.course?.title ?? 'Unknown Course',
      enrollmentCount,
      classAverage,
      attendanceRate,
      atRiskCount,
      topPerformers: metrics
        .filter((m) => !m.isAtRisk)
        .sort((a, b) => (b.averageGrade ?? 0) - (a.averageGrade ?? 0))
        .slice(0, 3)
        .map((m) => ({ studentId: m.studentId, studentName: m.studentName, average: m.averageGrade })),
      bottomPerformers: metrics
        .sort((a, b) => (a.averageGrade ?? 0) - (b.averageGrade ?? 0))
        .slice(0, 3)
        .map((m) => ({ studentId: m.studentId, studentName: m.studentName, average: m.averageGrade })),
    });
  }

  return { courses, totalStudents, totalAtRisk };
};

/** Fast — stats and courses only, plus whatever insights are already
 * cached (or null if the teacher has never generated any). Never calls
 * the LLM, so this never blocks on AI latency or cost. */
export const getTeacherDashboard = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;
    if (!userId) throw new Error('User ID not found');

    const { courses, totalStudents, totalAtRisk } = await loadTeacherCourseSummaries(userId);
    const cached = await teacherDashboardInsightRepository.findByTeacher(userId);

    return ok(res, {
      totalCourses: courses.length,
      totalStudents,
      totalAtRisk,
      courses,
      insights: cached?.content ?? null,
      insightsGeneratedAt: cached?.generatedAt.toISOString() ?? null,
    });
  },
);

/** Teacher-triggered only — never automatic, same cost-control principle as
 * At-Risk explanations, Lesson Planner, and Intervention generation.
 * Recomputes course data fresh (it may have changed since the cached
 * insights were generated) and replaces the cached row. */
export const generateTeacherDashboardInsights = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;
    if (!userId) throw new Error('User ID not found');

    const { courses, totalStudents, totalAtRisk } = await loadTeacherCourseSummaries(userId);

    const insightsContext: DashboardInsightsContext = {
      totalCourses: courses.length,
      totalStudents,
      totalAtRisk,
      courses: courses.map((c) => ({
        name: c.courseName,
        enrollmentCount: c.enrollmentCount,
        classAverage: c.classAverage,
        attendanceRate: c.attendanceRate,
        atRiskCount: c.atRiskCount,
      })),
    };

    const systemPrompt = teacherDashboardInsightsSystemPrompt();
    const userPrompt = teacherDashboardInsightsUserPrompt(insightsContext);

    let insights;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const raw = await generateJson(systemPrompt, userPrompt);
        insights = dashboardInsightsSchema.parse(JSON.parse(raw));
        break;
      } catch {
        if (attempt === 1) throw new ApiError(502, 'The LLM could not produce valid insights after a retry');
      }
    }
    if (!insights) throw new ApiError(502, 'The LLM could not produce valid insights after a retry');

    const saved = await teacherDashboardInsightRepository.upsert(userId, insights);

    return ok(
      res,
      { insights: saved.content, generatedAt: saved.generatedAt.toISOString() },
      'Insights generated',
    );
  },
);
