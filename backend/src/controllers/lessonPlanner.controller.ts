import type { Response } from 'express';

import type { AuthRequest } from '../types/auth.types.js';
import { courseRepository } from '../repositories/courses.repository.js';
import { generateJson } from '../services/llm.service.js';
import { lessonPlanSystemPrompt, lessonPlanUserPrompt } from '../prompts/lessonPlan.prompt.js';
import { asyncHandler } from '../utils/AsyncHandler.js';
import { ok } from '../utils/ApiResponse.js';
import { ApiError } from '../utils/ApiError.js';

/** Validate and parse the AI-generated lesson plan JSON. */
const parseLessonPlan = (raw: string) => {
  const parsed: unknown = JSON.parse(raw);

  if (typeof parsed !== 'object' || parsed === null) {
    throw new ApiError(502, 'Invalid lesson plan format');
  }

  const obj = parsed as Record<string, unknown>;

  if (typeof obj.title !== 'string' || obj.title.length === 0) {
    throw new ApiError(502, 'Lesson plan missing title');
  }
  if (!Array.isArray(obj.objectives) || obj.objectives.length === 0) {
    throw new ApiError(502, 'Lesson plan must have at least one objective');
  }
  if (!Array.isArray(obj.outline) || obj.outline.length === 0) {
    throw new ApiError(502, 'Lesson plan must have an outline');
  }
  if (!Array.isArray(obj.activities) || obj.activities.length === 0) {
    throw new ApiError(502, 'Lesson plan must have at least one activity');
  }
  if (!Array.isArray(obj.assessmentIdeas) || obj.assessmentIdeas.length === 0) {
    throw new ApiError(502, 'Lesson plan must have at least one assessment idea');
  }

  const validActivityTypes = ['discussion', 'practice', 'group', 'individual', 'demonstration'];

  const outline = obj.outline.map((s: unknown) => {
    if (typeof s !== 'object' || s === null) throw new ApiError(502, 'Invalid outline section');
    const sec = s as Record<string, unknown>;
    if (typeof sec.section !== 'string') throw new ApiError(502, 'Outline section missing name');
    if (typeof sec.durationMinutes !== 'number') throw new ApiError(502, 'Outline section missing duration');
    if (typeof sec.description !== 'string') throw new ApiError(502, 'Outline section missing description');
    return { section: sec.section, durationMinutes: sec.durationMinutes, description: sec.description };
  });

  const activities = obj.activities.map((a: unknown) => {
    if (typeof a !== 'object' || a === null) throw new ApiError(502, 'Invalid activity');
    const act = a as Record<string, unknown>;
    if (typeof act.name !== 'string') throw new ApiError(502, 'Activity missing name');
    if (typeof act.type !== 'string' || !validActivityTypes.includes(act.type)) {
      throw new ApiError(502, 'Activity has invalid type');
    }
    if (typeof act.description !== 'string') throw new ApiError(502, 'Activity missing description');
    if (typeof act.durationMinutes !== 'number') throw new ApiError(502, 'Activity missing duration');
    return {
      name: act.name,
      type: act.type,
      description: act.description,
      durationMinutes: act.durationMinutes,
    };
  });

  return {
    title: obj.title,
    objectives: obj.objectives.filter((o): o is string => typeof o === 'string'),
    outline,
    activities,
    assessmentIdeas: obj.assessmentIdeas.filter((a): a is string => typeof a === 'string'),
    ...(Array.isArray(obj.materials) ? { materials: obj.materials.filter((m): m is string => typeof m === 'string') } : {}),
  };
};

export const generateLessonPlan = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { courseId } = req.validated?.params as { courseId: string };
    const { topic, durationMinutes } = req.validated?.body as {
      topic: string;
      durationMinutes: number;
    };

    const course = await courseRepository.findById(courseId);

    const prompt = lessonPlanUserPrompt({
      topic,
      durationMinutes,
      courseTitle: course?.title,
      courseDescription: course?.description ?? undefined,
    });

    let rawResponse: string;
    try {
      rawResponse = await generateJson(lessonPlanSystemPrompt, prompt);
    } catch {
      throw new ApiError(502, 'Failed to generate lesson plan');
    }

    let plan: ReturnType<typeof parseLessonPlan>;
    try {
      plan = parseLessonPlan(rawResponse);
    } catch (err) {
      if (err instanceof ApiError) throw err;
      throw new ApiError(502, 'Invalid response from AI model');
    }

    return ok(res, plan, 'Lesson plan generated');
  },
);
