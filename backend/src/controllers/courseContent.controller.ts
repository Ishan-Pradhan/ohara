import fs from 'node:fs/promises';
import type { Response } from 'express';

import { sequelize } from '../config/db.js';
import type { AuthRequest } from '../types/auth.types.js';
import { documentRepository } from '../repositories/documents.repository.js';
import { moduleRepository } from '../repositories/modules.repository.js';
import { lessonRepository } from '../repositories/lessons.repository.js';
import { courseRepository } from '../repositories/courses.repository.js';
import { serializeModule, serializeLesson } from '../serializers/courseContent.serializer.js';
import { extractText } from '../services/pdf.service.js';
import { generateJson } from '../services/llm.service.js';
import {
  courseStructureSystemPrompt,
  courseStructureUserPrompt,
  courseStructureCorrectivePrompt,
} from '../prompts/courseStructure.prompt.js';
import { generatedCourseStructureSchema } from '../validations/courseContent.validation.js';
import { DOCUMENT_STATUS } from '../constants/index.js';
import { env } from '../config/env.js';
import { asyncHandler } from '../utils/AsyncHandler.js';
import { ok } from '../utils/ApiResponse.js';
import { ApiError } from '../utils/ApiError.js';
import type { Module } from '../models/modules.model.js';

/** Calls the LLM, parses and Zod-validates the response, and retries once
 * with a corrective re-prompt if it isn't valid JSON matching the required
 * shape. Bounded — never loops beyond one retry. */
const generateStructure = async (sourceText: string) => {
  const userPrompt = courseStructureUserPrompt(sourceText);
  const raw = await generateJson(courseStructureSystemPrompt, userPrompt);

  const firstAttempt = tryParse(raw);
  if (firstAttempt.success) return firstAttempt.data;

  const retryRaw = await generateJson(
    courseStructureSystemPrompt,
    courseStructureCorrectivePrompt(raw),
  );
  const secondAttempt = tryParse(retryRaw);
  if (secondAttempt.success) return secondAttempt.data;

  throw new ApiError(502, 'The LLM could not produce a valid course structure');
};

const tryParse = (raw: string) => {
  try {
    const json: unknown = JSON.parse(raw);
    return generatedCourseStructureSchema.safeParse(json);
  } catch {
    return { success: false as const };
  }
};

export const generateCourseStructure = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { courseId, documentId } = req.validated?.params as {
      courseId: string;
      documentId: string;
    };

    const document = await documentRepository.findById(documentId);
    if (!document || document.courseId !== courseId) {
      throw new ApiError(404, 'Document not found');
    }
    if (document.status !== DOCUMENT_STATUS.READY) {
      throw new ApiError(400, 'This document has not finished processing yet');
    }

    const fileBuffer = await fs.readFile(document.storageKey);
    const fullText = await extractText(fileBuffer);
    // A single chapter-sized PDF fits comfortably within MAX_LLM_SOURCE_CHARS;
    // a whole textbook in one upload doesn't (known limitation — see design
    // doc, not solved here).
    const sourceText = fullText.slice(0, env.MAX_LLM_SOURCE_CHARS);

    const structure = await generateStructure(sourceText);

    const startOrderIndex = (await moduleRepository.maxOrderIndex(courseId)) + 1;

    const createdModules = await sequelize.transaction(async (transaction) => {
      const modules: Module[] = [];
      for (const [moduleOffset, generatedModule] of structure.modules.entries()) {
        const module = await moduleRepository.create(
          {
            courseId,
            title: generatedModule.title,
            orderIndex: startOrderIndex + moduleOffset,
          },
          transaction,
        );

        const lessons = [];
        for (const [lessonIndex, generatedLesson] of generatedModule.lessons.entries()) {
          lessons.push(
            await lessonRepository.create(
              {
                moduleId: module.id,
                title: generatedLesson.title,
                content: generatedLesson.content,
                keyTopics: generatedLesson.keyTopics,
                orderIndex: lessonIndex,
              },
              transaction,
            ),
          );
        }

        module.lessons = lessons;
        modules.push(module);
      }
      return modules;
    });

    return ok(res, createdModules.map(serializeModule), 'Course structure generated', 201);
  },
);

// ── Modules ──────────────────────────────────────────────────────────────────

export const listModules = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { courseId } = req.validated?.params as { courseId: string };
    const modules = await moduleRepository.findAllByCourse(courseId);
    return ok(res, modules.map(serializeModule), 'Modules retrieved');
  },
);

export const createModule = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { courseId } = req.validated?.params as { courseId: string };
    const { title, orderIndex } = req.validated?.body as { title: string; orderIndex: number };

    const module = await moduleRepository.create({ courseId, title, orderIndex });
    module.lessons = [];
    return ok(res, serializeModule(module), 'Module created', 201);
  },
);

export const updateModule = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { courseId, id } = req.validated?.params as { courseId: string; id: string };
    const body = req.validated?.body as { title?: string; orderIndex?: number };

    const existing = await moduleRepository.findById(id);
    if (!existing || existing.courseId !== courseId) {
      throw new ApiError(404, 'Module not found');
    }

    const module = await moduleRepository.update(id, body);
    if (!module) {
      throw new ApiError(404, 'Module not found');
    }
    module.lessons = await lessonRepository.findAllByModule(id);
    return ok(res, serializeModule(module), 'Module updated');
  },
);

export const deleteModule = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { courseId, id } = req.validated?.params as { courseId: string; id: string };

    const existing = await moduleRepository.findById(id);
    if (!existing || existing.courseId !== courseId) {
      throw new ApiError(404, 'Module not found');
    }

    await moduleRepository.delete(id);
    return ok(res, null, 'Module deleted');
  },
);

// ── Lessons ──────────────────────────────────────────────────────────────────

/** Every lesson route is nested under both :courseId and :moduleId — this
 * confirms the module actually belongs to the course before any lesson
 * operation proceeds, the same IDOR guard used for module ownership above. */
const findOwnedModule = async (courseId: string, moduleId: string) => {
  const module = await moduleRepository.findById(moduleId);
  if (!module || module.courseId !== courseId) {
    throw new ApiError(404, 'Module not found');
  }
  return module;
};

export const createLesson = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { courseId, moduleId } = req.validated?.params as {
      courseId: string;
      moduleId: string;
    };
    const { title, content, keyTopics, orderIndex } = req.validated?.body as {
      title: string;
      content: string;
      keyTopics?: string[];
      orderIndex: number;
    };

    await findOwnedModule(courseId, moduleId);

    const lesson = await lessonRepository.create({
      moduleId,
      title,
      content,
      keyTopics: keyTopics ?? [],
      orderIndex,
    });
    return ok(res, serializeLesson(lesson), 'Lesson created', 201);
  },
);

export const updateLesson = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { courseId, moduleId, id } = req.validated?.params as {
      courseId: string;
      moduleId: string;
      id: string;
    };
    const body = req.validated?.body as {
      title?: string;
      content?: string;
      keyTopics?: string[];
      orderIndex?: number;
    };

    await findOwnedModule(courseId, moduleId);

    const existing = await lessonRepository.findById(id);
    if (!existing || existing.moduleId !== moduleId) {
      throw new ApiError(404, 'Lesson not found');
    }

    const lesson = await lessonRepository.update(id, body);
    if (!lesson) {
      throw new ApiError(404, 'Lesson not found');
    }
    return ok(res, serializeLesson(lesson), 'Lesson updated');
  },
);

export const deleteLesson = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { courseId, moduleId, id } = req.validated?.params as {
      courseId: string;
      moduleId: string;
      id: string;
    };

    await findOwnedModule(courseId, moduleId);

    const existing = await lessonRepository.findById(id);
    if (!existing || existing.moduleId !== moduleId) {
      throw new ApiError(404, 'Lesson not found');
    }

    await lessonRepository.delete(id);
    return ok(res, null, 'Lesson deleted');
  },
);

// ── Publish ──────────────────────────────────────────────────────────────────

export const publishCourse = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { courseId } = req.validated?.params as { courseId: string };
    const { isPublished } = req.validated?.body as { isPublished: boolean };

    const course = await courseRepository.setPublished(courseId, isPublished);
    if (!course) {
      throw new ApiError(404, 'Course not found');
    }

    return ok(res, { id: course.id, isPublished: course.isPublished }, 'Course publish state updated');
  },
);
