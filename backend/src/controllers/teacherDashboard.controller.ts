import type { Response } from 'express';

import type { AuthRequest } from '../types/auth.types.js';
import { courseTeacherRepository } from '../repositories/courseTeachers.repository.js';
import { computeCourseMetrics } from './classIntelligence.controller.js';
import { generateJson } from '../services/llm.service.js';
import {
  teacherDashboardInsightsSystemPrompt,
  teacherDashboardInsightsUserPrompt,
} from '../prompts/teacherDashboardInsights.prompt.js';
import type { DashboardInsightsContext } from '../prompts/teacherDashboardInsights.prompt.js';
import { asyncHandler } from '../utils/AsyncHandler.js';
import { ok } from '../utils/ApiResponse.js';

export const getTeacherDashboard = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;
    if (!userId) throw new Error('User ID not found');

    const assignments = await courseTeacherRepository.findByTeacherId(userId);

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

    // AI insights
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

    let insights = null;
    try {
      const raw = await generateJson(
        teacherDashboardInsightsSystemPrompt(),
        teacherDashboardInsightsUserPrompt(insightsContext),
      );
      insights = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      // AI failure is non-fatal
    }

    return ok(res, {
      totalCourses: courses.length,
      totalStudents,
      totalAtRisk,
      courses,
      insights,
    });
  },
);
