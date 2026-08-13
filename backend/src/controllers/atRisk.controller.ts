import type { Response } from 'express';

import type { AuthRequest } from '../types/auth.types.js';
import { courseRepository } from '../repositories/courses.repository.js';
import { ClassMembership } from '../models/classMemberships.model.js';
import { computeCourseMetrics } from './classIntelligence.controller.js';
import { generateText } from '../services/llm.service.js';
import {
  atRiskExplanationSystemPrompt,
  atRiskExplanationUserPrompt,
} from '../prompts/atRiskExplanation.prompt.js';
import {
  AT_RISK_MIN_AVERAGE_PERCENT,
  AT_RISK_MIN_ATTENDANCE_PERCENT,
  AT_RISK_MAX_MISSING_SUBMISSIONS,
} from '../constants/index.js';
import { asyncHandler } from '../utils/AsyncHandler.js';
import { ok } from '../utils/ApiResponse.js';
import { ApiError } from '../utils/ApiError.js';

export const getAtRiskDashboard = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { courseId } = req.validated?.params as { courseId: string };
    const { sectionId, batchId } = (req.validated?.query ?? {}) as {
      sectionId?: string;
      batchId?: string;
    };

    // batchId omitted -> the course's current batch (unchanged default).
    // Given -> a specific past batch's at-risk metrics (viewing
    // completed-course history). sectionId stays a separate, optional
    // narrowing filter for when a batch has more than one section.
    let metrics = await computeCourseMetrics(courseId, batchId);

    // When a section is selected, filter to only students in that section
    if (sectionId) {
      const memberships = await ClassMembership.findAll({
        where: { sectionId },
        attributes: ['studentId'],
      });
      const sectionStudentIds = new Set(memberships.map((m) => m.studentId));
      metrics = metrics.filter((m) => sectionStudentIds.has(m.studentId));
    }

    return ok(res, metrics, 'At-risk dashboard retrieved');
  },
);

/** FR-42: teacher-triggered, never automatic — same cost-control principle
 * as AI grading (assignmentGradingLimiter gates the route). */
export const explainAtRisk = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { courseId, studentId } = req.validated?.params as { courseId: string; studentId: string };
    const { batchId } = (req.validated?.query ?? {}) as { batchId?: string };

    const metrics = await computeCourseMetrics(courseId, batchId);
    const studentMetrics = metrics.find((m) => m.studentId === studentId);
    if (!studentMetrics) {
      throw new ApiError(404, 'Student not found in this course');
    }

    const course = await courseRepository.findById(courseId);

    const prompt = atRiskExplanationUserPrompt({
      studentName: studentMetrics.studentName,
      courseName: course?.title ?? 'this course',
      averageGrade: studentMetrics.averageGrade,
      attendancePercentage: studentMetrics.attendancePercentage,
      missingSubmissions: studentMetrics.missingSubmissions,
      lateSubmissions: studentMetrics.lateSubmissions,
      minAverageThreshold: AT_RISK_MIN_AVERAGE_PERCENT,
      minAttendanceThreshold: AT_RISK_MIN_ATTENDANCE_PERCENT,
      maxMissingThreshold: AT_RISK_MAX_MISSING_SUBMISSIONS,
    });
    const explanation = await generateText(atRiskExplanationSystemPrompt, prompt);

    return ok(res, { studentId, explanation: explanation.trim() }, 'Explanation generated');
  },
);
