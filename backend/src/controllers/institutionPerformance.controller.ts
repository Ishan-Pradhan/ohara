import type { Response } from 'express';

import type { AuthRequest } from '../types/auth.types.js';
import { programRepository } from '../repositories/programs.repository.js';
import { classRepository } from '../repositories/classes.repository.js';
import { courseRepository } from '../repositories/courses.repository.js';
import { userRepository } from '../repositories/users.repository.js';
import { enrollmentRepository } from '../repositories/enrollments.repository.js';
import { computeCourseMetrics } from './classIntelligence.controller.js';
import { generateJson } from '../services/llm.service.js';
import {
  institutionPerformanceSystemPrompt,
  institutionPerformanceUserPrompt,
} from '../prompts/institutionPerformance.prompt.js';
import type { InstitutionPerformanceContext } from '../prompts/institutionPerformance.prompt.js';
import { asyncHandler } from '../utils/AsyncHandler.js';
import { ok } from '../utils/ApiResponse.js';
import { USER_ROLES } from '../constants/index.js';

export const getInstitutionPerformance = asyncHandler(
  async (_req: AuthRequest, res: Response) => {
    // Fetch structural counts
    const [programs, classes, allCourses, allStudents, allTeachers] = await Promise.all([
      programRepository.findAll(),
      classRepository.findAll(),
      courseRepository.findAll(),
      userRepository.findAll({ role: USER_ROLES.STUDENT }),
      userRepository.findAll({ role: USER_ROLES.TEACHER }),
    ]);

    // Enrollment count
    const allEnrollments = await enrollmentRepository.findAll();
    const activeEnrollments = allEnrollments.filter((e) => e.status === 'active');

    // Compute per-course metrics
    const courseMetrics = [];
    for (const course of allCourses) {
      try {
        const metrics = await computeCourseMetrics(course.id);
        const enrollmentCount = metrics.length;
        const atRiskCount = metrics.filter((m) => m.isAtRisk).length;
        const classAverage =
          enrollmentCount > 0
            ? metrics.reduce((sum, m) => sum + (m.averageGrade ?? 0), 0) / enrollmentCount
            : null;
        const attendanceRate =
          enrollmentCount > 0
            ? metrics.reduce((sum, m) => sum + (m.attendancePercentage ?? 0), 0) / enrollmentCount
            : null;
        const totalMissing = metrics.reduce((sum, m) => sum + m.missingSubmissions, 0);

        courseMetrics.push({
          courseId: course.id,
          courseName: course.title,
          programName: programs.find((p) => {
            const cls = classes.find((c) => c.id === course.classId);
            return cls?.programId === p.id;
          })?.name ?? 'Unknown',
          enrollmentCount,
          classAverage,
          attendanceRate,
          atRiskCount,
          totalMissing,
        });
      } catch {
        // Skip courses that fail to compute
      }
    }

    // Aggregate program-level metrics
    const programMap = new Map<string, { name: string; courseCount: number; studentCount: number; totalAvg: number; avgCount: number; totalAttendance: number; attCount: number; atRiskCount: number }>();
    for (const pm of courseMetrics) {
      const existing = programMap.get(pm.programName) ?? { name: pm.programName, courseCount: 0, studentCount: 0, totalAvg: 0, avgCount: 0, totalAttendance: 0, attCount: 0, atRiskCount: 0 };
      existing.courseCount++;
      existing.studentCount += pm.enrollmentCount;
      if (pm.classAverage !== null) { existing.totalAvg += pm.classAverage; existing.avgCount++; }
      if (pm.attendanceRate !== null) { existing.totalAttendance += pm.attendanceRate; existing.attCount++; }
      existing.atRiskCount += pm.atRiskCount;
      programMap.set(pm.programName, existing);
    }

    const programSummaries = Array.from(programMap.values()).map((p) => ({
      name: p.name,
      courseCount: p.courseCount,
      studentCount: p.studentCount,
      averageGrade: p.avgCount > 0 ? p.totalAvg / p.avgCount : null,
      attendanceRate: p.attCount > 0 ? p.totalAttendance / p.attCount : null,
      atRiskCount: p.atRiskCount,
    }));

    // Institution-wide aggregates
    const totalAtRisk = courseMetrics.reduce((sum, c) => sum + c.atRiskCount, 0);
    const coursesWithAvg = courseMetrics.filter((c) => c.classAverage !== null);
    const overallAverageGrade = coursesWithAvg.length > 0
      ? coursesWithAvg.reduce((sum, c) => sum + c.classAverage!, 0) / coursesWithAvg.length
      : null;
    const coursesWithAtt = courseMetrics.filter((c) => c.attendanceRate !== null);
    const overallAttendanceRate = coursesWithAtt.length > 0
      ? coursesWithAtt.reduce((sum, c) => sum + c.attendanceRate!, 0) / coursesWithAtt.length
      : null;
    const totalMissing = courseMetrics.reduce((sum, c) => sum + c.totalMissing, 0);
    const atRiskRate = activeEnrollments.length > 0 ? (totalAtRisk / activeEnrollments.length) * 100 : null;

    // Top/bottom 5 courses by average
    const sortedByAvg = [...courseMetrics]
      .filter((c) => c.classAverage !== null)
      .sort((a, b) => b.classAverage! - a.classAverage!);
    const topCourses = sortedByAvg.slice(0, 5).map((c) => ({ name: c.courseName, averageGrade: c.classAverage, enrollmentCount: c.enrollmentCount }));
    const bottomCourses = sortedByAvg.slice(-5).reverse().map((c) => ({ name: c.courseName, averageGrade: c.classAverage, enrollmentCount: c.enrollmentCount }));

    const context: InstitutionPerformanceContext = {
      institutionName: 'the institution',
      totals: {
        programs: programs.length,
        classes: classes.length,
        courses: allCourses.length,
        students: allStudents.length,
        teachers: allTeachers.length,
        activeEnrollments: activeEnrollments.length,
      },
      academic: {
        overallAverageGrade,
        overallAttendanceRate,
        totalAtRisk,
        atRiskRate,
        totalSubmissions: 0, // Would require full gradebook scan — omit for now
        totalMissingSubmissions: totalMissing,
      },
      programs: programSummaries,
      topCourses,
      bottomCourses,
    };

    // AI insights
    let insights = null;
    try {
      const raw = await generateJson(
        institutionPerformanceSystemPrompt(),
        institutionPerformanceUserPrompt(context),
      );
      insights = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      // AI failure is non-fatal
    }

    return ok(res, {
      totals: context.totals,
      academic: context.academic,
      programs: programSummaries,
      topCourses,
      bottomCourses,
      insights,
    });
  },
);
