import type { Response } from 'express';

import type { AuthRequest } from '../types/auth.types.js';
import { interventionRepository } from '../repositories/intervention.repository.js';
import { courseRepository } from '../repositories/courses.repository.js';
import { enrollmentRepository } from '../repositories/enrollments.repository.js';
import { computeCourseMetrics } from './classIntelligence.controller.js';
import { loadGradebook } from './gradebook.controller.js';
import { generateJson } from '../services/llm.service.js';
import {
  interventionPlanSystemPrompt,
  interventionPlanUserPrompt,
} from '../prompts/interventionPlan.prompt.js';
import {
  AT_RISK_MIN_AVERAGE_PERCENT,
  AT_RISK_MIN_ATTENDANCE_PERCENT,
  AT_RISK_MAX_MISSING_SUBMISSIONS,
} from '../constants/index.js';
import { asyncHandler } from '../utils/AsyncHandler.js';
import { ok } from '../utils/ApiResponse.js';
import { ApiError } from '../utils/ApiError.js';
import type { InterventionAction } from '../models/intervention.model.js';

/** Validate and parse the AI-generated intervention plan JSON. */
const parseInterventionPlan = (raw: string): {
  title: string;
  summary: string;
  actions: InterventionAction[];
  priority: string;
} => {
  const parsed: unknown = JSON.parse(raw);

  if (typeof parsed !== 'object' || parsed === null) {
    throw new ApiError(502, 'Invalid intervention plan format');
  }

  const obj = parsed as Record<string, unknown>;

  if (typeof obj.title !== 'string' || obj.title.length === 0) {
    throw new ApiError(502, 'Intervention plan missing title');
  }
  if (typeof obj.summary !== 'string' || obj.summary.length === 0) {
    throw new ApiError(502, 'Intervention plan missing summary');
  }
  if (!Array.isArray(obj.actions) || obj.actions.length === 0) {
    throw new ApiError(502, 'Intervention plan must have at least one action');
  }
  if (typeof obj.priority !== 'string' || !['high', 'medium', 'low'].includes(obj.priority)) {
    throw new ApiError(502, 'Intervention plan has invalid priority');
  }

  const actions: InterventionAction[] = obj.actions.map((a: unknown) => {
    if (typeof a !== 'object' || a === null) throw new ApiError(502, 'Invalid action format');
    const act = a as Record<string, unknown>;
    if (typeof act.description !== 'string') throw new ApiError(502, 'Action missing description');
    if (typeof act.timeline !== 'string') throw new ApiError(502, 'Action missing timeline');
    return {
      description: act.description,
      timeline: act.timeline,
      ...(typeof act.resources === 'string' ? { resources: act.resources } : {}),
    };
  });

  return { title: obj.title, summary: obj.summary, actions, priority: obj.priority };
};

export const generateInterventionPlan = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { courseId, studentId } = req.validated?.params as { courseId: string; studentId: string };
    const teacherId = req.user?.id;
    if (!teacherId) throw new ApiError(401, 'Unauthorized');

    const metrics = await computeCourseMetrics(courseId);
    const studentMetrics = metrics.find((m) => m.studentId === studentId);
    if (!studentMetrics) {
      throw new ApiError(404, 'Student not found in this course');
    }

    const course = await courseRepository.findById(courseId);
    const gradebook = await loadGradebook(courseId);

    const studentRow = gradebook.rows.find((r) => r.studentId === studentId);
    const recentQuizScores = studentRow?.entries
      .filter((e) => e.type === 'quiz' && e.status === 'graded')
      .slice(-5)
      .map((e) => `${e.type === 'quiz' ? 'Quiz' : 'Assignment'}: ${e.score}/${e.maxScore}`)
      .join(', ') || 'no recent quiz data';

    const recentSubmissionStatuses = studentRow?.entries
      .filter((e) => e.type === 'assignment')
      .slice(-5)
      .map((e) => `${e.status}`)
      .join(', ') || 'no recent submission data';

    const prompt = interventionPlanUserPrompt({
      studentName: studentMetrics.studentName,
      courseName: course?.title ?? 'this course',
      averageGrade: studentMetrics.averageGrade,
      attendancePercentage: studentMetrics.attendancePercentage,
      missingSubmissions: studentMetrics.missingSubmissions,
      lateSubmissions: studentMetrics.lateSubmissions,
      isAtRisk: studentMetrics.isAtRisk,
      minAverageThreshold: AT_RISK_MIN_AVERAGE_PERCENT,
      minAttendanceThreshold: AT_RISK_MIN_ATTENDANCE_PERCENT,
      maxMissingThreshold: AT_RISK_MAX_MISSING_SUBMISSIONS,
      recentQuizScores,
      recentSubmissionStatuses,
    });

    let rawResponse: string;
    try {
      rawResponse = await generateJson(interventionPlanSystemPrompt, prompt);
    } catch {
      throw new ApiError(502, 'Failed to generate intervention plan');
    }

    let plan: ReturnType<typeof parseInterventionPlan>;
    try {
      plan = parseInterventionPlan(rawResponse);
    } catch (err) {
      if (err instanceof ApiError) throw err;
      throw new ApiError(502, 'Invalid response from AI model');
    }

    const intervention = await interventionRepository.create({
      studentId,
      courseId,
      teacherId,
      type: 'ai_generated',
      title: plan.title,
      notes: plan.summary,
      actions: plan.actions,
      metricsAtCreation: {
        averageGrade: studentMetrics.averageGrade,
        attendancePercentage: studentMetrics.attendancePercentage,
        missingSubmissions: studentMetrics.missingSubmissions,
        lateSubmissions: studentMetrics.lateSubmissions,
        isAtRisk: studentMetrics.isAtRisk,
      },
    });

    const saved = await interventionRepository.findById(intervention.id);
    return ok(res, saved?.toJSON() ?? intervention.toJSON(), 'Intervention plan generated');
  },
);

export const createIntervention = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { courseId } = req.validated?.params as { courseId: string };
    const { studentId, type, title, notes, actions } = req.validated?.body as {
      studentId: string;
      type: 'manual' | 'meeting' | 'tutoring' | 'other';
      title: string;
      notes: string;
      actions: InterventionAction[];
    };
    const teacherId = req.user?.id;
    if (!teacherId) throw new ApiError(401, 'Unauthorized');

    const enrollment = await enrollmentRepository.findByCourseWithStudents(courseId);
    const isEnrolled = enrollment.some((e) => e.studentId === studentId);
    if (!isEnrolled) {
      throw new ApiError(404, 'Student not enrolled in this course');
    }

    const intervention = await interventionRepository.create({
      studentId,
      courseId,
      teacherId,
      type,
      title,
      notes,
      actions,
      metricsAtCreation: null,
    });

    const saved = await interventionRepository.findById(intervention.id);
    return ok(res, saved?.toJSON() ?? intervention.toJSON(), 'Intervention created', 201);
  },
);

export const getInterventions = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { courseId } = req.validated?.params as { courseId: string };
    const { studentId } = (req.validated?.query ?? {}) as { studentId?: string };

    const interventions = studentId
      ? await interventionRepository.findByCourseAndStudent(courseId, studentId)
      : await interventionRepository.findByCourse(courseId);

    return ok(res, interventions.map((i) => i.toJSON()), 'Interventions retrieved');
  },
);

export const getIntervention = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { id } = req.validated?.params as { id: string };
    const intervention = await interventionRepository.findById(id);
    if (!intervention) {
      throw new ApiError(404, 'Intervention not found');
    }
    return ok(res, intervention.toJSON(), 'Intervention retrieved');
  },
);

export const updateIntervention = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { id } = req.validated?.params as { id: string };
    const body = req.validated?.body as {
      title?: string;
      notes?: string;
      status?: 'active' | 'resolved' | 'dismissed';
      actions?: InterventionAction[];
    };

    const intervention = await interventionRepository.findById(id);
    if (!intervention) {
      throw new ApiError(404, 'Intervention not found');
    }

    const teacherId = req.user?.id;
    if (intervention.teacherId !== teacherId && req.user?.role !== 'admin') {
      throw new ApiError(403, 'You can only edit your own interventions');
    }

    const updated = await interventionRepository.update(id, body);
    if (!updated) throw new ApiError(404, 'Intervention not found');
    const saved = await interventionRepository.findById(id);
    return ok(res, saved?.toJSON() ?? updated.toJSON(), 'Intervention updated');
  },
);

export const resolveIntervention = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { id } = req.validated?.params as { id: string };

    const intervention = await interventionRepository.findById(id);
    if (!intervention) {
      throw new ApiError(404, 'Intervention not found');
    }

    const teacherId = req.user?.id;
    if (intervention.teacherId !== teacherId && req.user?.role !== 'admin') {
      throw new ApiError(403, 'You can only resolve your own interventions');
    }

    const metrics = await computeCourseMetrics(intervention.courseId);
    const studentMetrics = metrics.find((m) => m.studentId === intervention.studentId);

    const updated = await interventionRepository.update(id, {
      status: 'resolved',
      resolvedAt: new Date(),
      metricsAtResolution: studentMetrics ? {
        averageGrade: studentMetrics.averageGrade,
        attendancePercentage: studentMetrics.attendancePercentage,
        missingSubmissions: studentMetrics.missingSubmissions,
        lateSubmissions: studentMetrics.lateSubmissions,
        isAtRisk: studentMetrics.isAtRisk,
      } : null,
    });

    if (!updated) throw new ApiError(404, 'Intervention not found');
    const saved = await interventionRepository.findById(id);
    return ok(res, saved?.toJSON() ?? updated.toJSON(), 'Intervention resolved');
  },
);

export const deleteIntervention = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { id } = req.validated?.params as { id: string };

    const intervention = await interventionRepository.findById(id);
    if (!intervention) {
      throw new ApiError(404, 'Intervention not found');
    }

    const teacherId = req.user?.id;
    if (intervention.teacherId !== teacherId && req.user?.role !== 'admin') {
      throw new ApiError(403, 'You can only delete your own interventions');
    }

    await interventionRepository.delete(id);
    return ok(res, null, 'Intervention deleted');
  },
);

export const getInterventionOutcome = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { id } = req.validated?.params as { id: string };

    const intervention = await interventionRepository.findById(id);
    if (!intervention) {
      throw new ApiError(404, 'Intervention not found');
    }

    const before = intervention.metricsAtCreation as Record<string, unknown> | null;
    const after = intervention.metricsAtResolution as Record<string, unknown> | null;

    if (!before) {
      return ok(res, { hasOutcome: false, reason: 'No baseline metrics captured at creation' }, 'No outcome data');
    }

    if (!after) {
      return ok(res, { hasOutcome: false, reason: 'Intervention not yet resolved' }, 'No outcome data');
    }

    const diff = (a: number | null, b: number | null): { change: number; trend: 'improved' | 'declined' | 'stable' } => {
      if (a === null || b === null) return { change: 0, trend: 'stable' };
      const change = Math.round((b - a) * 10) / 10;
      if (change > 1) return { change, trend: 'improved' };
      if (change < -1) return { change, trend: 'declined' };
      return { change, trend: 'stable' };
    };

    const avgGradeBefore = before.averageGrade as number | null;
    const avgGradeAfter = after.averageGrade as number | null;
    const attendanceBefore = before.attendancePercentage as number | null;
    const attendanceAfter = after.attendancePercentage as number | null;
    const missingBefore = before.missingSubmissions as number;
    const missingAfter = after.missingSubmissions as number;
    const lateBefore = before.lateSubmissions as number;
    const lateAfter = after.lateSubmissions as number;
    const atRiskBefore = before.isAtRisk as boolean;
    const atRiskAfter = after.isAtRisk as boolean;

    return ok(res, {
      hasOutcome: true,
      interventionId: intervention.id,
      status: intervention.status,
      resolvedAt: intervention.resolvedAt,
      metrics: {
        averageGrade: {
          before: avgGradeBefore,
          after: avgGradeAfter,
          ...diff(avgGradeBefore, avgGradeAfter),
        },
        attendancePercentage: {
          before: attendanceBefore,
          after: attendanceAfter,
          ...diff(attendanceBefore, attendanceAfter),
        },
        missingSubmissions: {
          before: missingBefore,
          after: missingAfter,
          change: missingAfter - missingBefore,
          trend: missingAfter < missingBefore ? 'improved' : missingAfter > missingBefore ? 'declined' : 'stable',
        },
        lateSubmissions: {
          before: lateBefore,
          after: lateAfter,
          change: lateAfter - lateBefore,
          trend: lateAfter < lateBefore ? 'improved' : lateAfter > lateBefore ? 'declined' : 'stable',
        },
        isAtRisk: {
          before: atRiskBefore,
          after: atRiskAfter,
          resolved: atRiskBefore && !atRiskAfter,
        },
      },
    }, 'Intervention outcome retrieved');
  },
);
