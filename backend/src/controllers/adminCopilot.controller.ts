import type { Response } from 'express';

import type { AuthRequest } from '../types/auth.types.js';
import { programRepository } from '../repositories/programs.repository.js';
import { classRepository } from '../repositories/classes.repository.js';
import { courseRepository } from '../repositories/courses.repository.js';
import { userRepository } from '../repositories/users.repository.js';
import { interventionRepository } from '../repositories/intervention.repository.js';
import { computeCourseMetrics } from './classIntelligence.controller.js';
import { generateText } from '../services/llm.service.js';
import { adminCopilotSystemPrompt, adminCopilotUserPrompt } from '../prompts/adminCopilot.prompt.js';
import { asyncHandler } from '../utils/AsyncHandler.js';
import { ok } from '../utils/ApiResponse.js';
import { ApiError } from '../utils/ApiError.js';
import { USER_ROLES } from '../constants/index.js';

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

export const adminCopilotQuery = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { question } = req.validated?.body as { question: string };

    if (!question || question.trim().length === 0) {
      throw new ApiError(400, 'Question is required');
    }

    const dataContext = await buildAdminDataContext();
    const answer = await generateText(
      adminCopilotSystemPrompt(),
      adminCopilotUserPrompt(question, dataContext),
    );

    return ok(res, { answer, dataContext });
  },
);
