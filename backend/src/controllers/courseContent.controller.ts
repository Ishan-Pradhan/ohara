import fs from 'node:fs/promises';
import type { Response } from 'express';

import { sequelize } from '../config/db.js';
import type { AuthRequest } from '../types/auth.types.js';
import { documentRepository } from '../repositories/documents.repository.js';
import { moduleRepository } from '../repositories/modules.repository.js';
import { lessonRepository } from '../repositories/lessons.repository.js';
import { courseRepository } from '../repositories/courses.repository.js';
import { serializeModule, serializeLesson } from '../serializers/courseContent.serializer.js';
import { serializeBatch } from '../serializers/institution.serializer.js';
import { listBatchesForCourse } from './courses.controller.js';
import { extractDocumentText } from '../utils/fileExtraction.utils.js';
import { generateJson } from '../services/llm.service.js';
import { downloadBuffer } from '../services/cloudinary.service.js';
import { retrieveKnowledgeBaseMaterial } from './documents.controller.js';
import type { Document } from '../models/documents.model.js';
import {
  courseSkeletonSystemPrompt,
  courseSkeletonUserPrompt,
  courseSkeletonFromSyllabusSystemPrompt,
  courseSkeletonFromSyllabusUserPrompt,
  courseSkeletonCorrectivePrompt,
  moduleContentSystemPrompt,
  moduleContentUserPrompt,
  moduleContentCorrectivePrompt,
} from '../prompts/courseStructure.prompt.js';
import {
  generatedCourseSkeletonSchema,
  generatedModuleContentSchema,
} from '../validations/courseContent.validation.js';
import {
  DOCUMENT_STATUS,
  MODULE_CONTENT_MAX_COMPLETION_TOKENS,
  MODULE_CONTENT_RETRIEVAL_K,
  MODULE_CONTENT_SOURCE_FALLBACK_CHARS,
  COURSE_SKELETON_MAX_SOURCE_CHARS,
  COURSE_SKELETON_MAX_COMPLETION_TOKENS,
} from '../constants/index.js';
import { env } from '../config/env.js';
import { asyncHandler } from '../utils/AsyncHandler.js';
import { ok } from '../utils/ApiResponse.js';
import { ApiError } from '../utils/ApiError.js';
import { logger } from '../utils/logger.js';
import type { Module } from '../models/modules.model.js';

/** Phase 1: one call over the whole source, producing just module/lesson
 * titles + key topics — see courseStructure.prompt.ts for why content is
 * deliberately not requested here. Retries once on invalid JSON.
 *
 * When syllabusText is given (the course has a Course.syllabusDocumentId —
 * see generateCourseStructure below), this EXTRACTS the structure from that
 * official syllabus instead of inventing one from sourceText — sourceText
 * is unused in that case, kept as a parameter only so the corrective retry
 * and error handling stay identical between the two modes.
 *
 * Both sourceText and syllabusText arrive already truncated to
 * MAX_LLM_SOURCE_CHARS (250,000 chars) by the caller — far more than this
 * phase can actually send in one request. Re-truncated here to
 * COURSE_SKELETON_MAX_SOURCE_CHARS, which is sized to fit under Groq's TPM
 * ceiling alongside COURSE_SKELETON_MAX_COMPLETION_TOKENS (see
 * constants/index.ts) — this phase can't use module-content generation's
 * RAG-retrieval fix, since it needs a global view of the document to find
 * module/lesson boundaries in the first place. */
const generateSkeleton = async (sourceText: string, syllabusText: string | null) => {
  const systemPrompt = syllabusText ? courseSkeletonFromSyllabusSystemPrompt : courseSkeletonSystemPrompt;
  const userPrompt = syllabusText
    ? courseSkeletonFromSyllabusUserPrompt(syllabusText.slice(0, COURSE_SKELETON_MAX_SOURCE_CHARS))
    : courseSkeletonUserPrompt(sourceText.slice(0, COURSE_SKELETON_MAX_SOURCE_CHARS));
  const raw = await generateJson(systemPrompt, userPrompt, COURSE_SKELETON_MAX_COMPLETION_TOKENS);

  const firstAttempt = tryParseSkeleton(raw);
  if (firstAttempt.success) return firstAttempt.data;

  const retryRaw = await generateJson(
    systemPrompt,
    courseSkeletonCorrectivePrompt(raw),
    COURSE_SKELETON_MAX_COMPLETION_TOKENS,
  );
  const secondAttempt = tryParseSkeleton(retryRaw);
  if (secondAttempt.success) return secondAttempt.data;

  throw new ApiError(502, 'The LLM could not produce a valid course structure');
};

const tryParseSkeleton = (raw: string) => {
  try {
    const json: unknown = JSON.parse(raw);
    return generatedCourseSkeletonSchema.safeParse(json);
  } catch {
    return { success: false as const };
  }
};

const placeholderContent = (lesson: { title: string; keyTopics: string[] }): string =>
  `_Content generation failed for this lesson. Topics: ${lesson.keyTopics.join(', ') || lesson.title}. Edit this lesson manually or try Generate structure again._`;

/** A module's lesson titles + key topics, joined into one query string for
 * RAG retrieval (resolveModuleSourceText below) — stands in for "what is
 * this module about" since there's no single user question to embed here,
 * unlike the tutor/quiz/lesson-planner's retrieval callers. */
const buildModuleRetrievalQuery = (
  moduleTitle: string,
  lessons: { title: string; keyTopics: string[] }[],
): string => [moduleTitle, ...lessons.flatMap((l) => [l.title, ...l.keyTopics])].join(' ');

/** RAG-retrieves the chunks relevant to one module instead of resending the
 * whole document — the fix for Groq's on_demand tier rejecting the
 * module-content call outright once a document is more than a few pages
 * (see MODULE_CONTENT_RETRIEVAL_K). Falls back to a short, hard-capped
 * slice of the full source text only if retrieval finds nothing, which
 * shouldn't happen for a status: 'ready' document — ingestion chunks it
 * before marking it ready — but a document with genuinely no chunks
 * (id mismatch, deleted chunks) must not fall back to sending the entire
 * fallbackSourceText, which is exactly the request-too-large failure this
 * replaces. */
const resolveModuleSourceText = async (
  documentId: string,
  fallbackSourceText: string,
  moduleTitle: string,
  lessons: { title: string; keyTopics: string[] }[],
): Promise<string> => {
  const query = buildModuleRetrievalQuery(moduleTitle, lessons);
  const material = await retrieveKnowledgeBaseMaterial(documentId, query, MODULE_CONTENT_RETRIEVAL_K);
  if (material) return material;

  logger.warn(
    { documentId, moduleTitle },
    'No relevant chunks found for module content generation; falling back to a short source slice',
  );
  return fallbackSourceText.slice(0, MODULE_CONTENT_SOURCE_FALLBACK_CHARS);
};

/** Phase 2: one call per MODULE — every lesson in that module written in
 * one response, not the whole course in one call (rations depth too thin
 * across many items) and not one call per lesson (would mean re-embedding
 * and re-searching per lesson for no benefit — a module's lessons share
 * enough context to search together). See courseStructure.prompt.ts.
 * Falls back to a placeholder per lesson rather than aborting the rest of
 * the generation if this module's call never produces valid JSON, omits a
 * lesson the skeleton asked for, OR the call itself fails outright (a Groq
 * rate limit — see llm.service.ts's toLlmError — is just as recoverable
 * here as invalid JSON is: real incident 2026-08-25, a module hitting the
 * per-minute limit deep into a multi-module generation used to throw away
 * every module already generated before it, after several minutes of real
 * work, instead of finishing with a placeholder for the one module that
 * failed). */
const generateModuleContent = async (
  documentId: string,
  fallbackSourceText: string,
  moduleTitle: string,
  lessons: { title: string; keyTopics: string[] }[],
): Promise<Map<string, string>> => {
  try {
    const moduleSourceText = await resolveModuleSourceText(documentId, fallbackSourceText, moduleTitle, lessons);
    const userPrompt = moduleContentUserPrompt(moduleSourceText, moduleTitle, lessons);
    const raw = await generateJson(
      moduleContentSystemPrompt,
      userPrompt,
      MODULE_CONTENT_MAX_COMPLETION_TOKENS,
    );

    const firstAttempt = tryParseModuleContent(raw);
    if (firstAttempt.success) return contentByTitle(firstAttempt.data);

    const retryRaw = await generateJson(
      moduleContentSystemPrompt,
      moduleContentCorrectivePrompt(raw),
      MODULE_CONTENT_MAX_COMPLETION_TOKENS,
    );
    const secondAttempt = tryParseModuleContent(retryRaw);
    if (secondAttempt.success) return contentByTitle(secondAttempt.data);

    logger.warn({ moduleTitle }, 'Module content generation failed twice; using placeholders');
    return new Map();
  } catch (err) {
    logger.warn({ err, moduleTitle }, 'Module content generation errored; using placeholders');
    return new Map();
  }
};

const contentByTitle = (data: { lessons: { title: string; content: string }[] }): Map<string, string> =>
  new Map(data.lessons.map((l) => [l.title, l.content]));

const tryParseModuleContent = (raw: string) => {
  try {
    const json: unknown = JSON.parse(raw);
    return generatedModuleContentSchema.safeParse(json);
  } catch {
    return { success: false as const };
  }
};

/** Re-reads a previously uploaded document's raw bytes — from Cloudinary for
 * a document uploaded after the storage migration, or from local disk for an
 * older row that still only has storageKey. */
const readDocumentBuffer = async (document: Document): Promise<Buffer> => {
  if (document.fileUrl) {
    return await downloadBuffer(document.fileUrl);
  }
  if (!document.storageKey) {
    throw new Error(`Document ${document.id} has no stored file`);
  }
  return await fs.readFile(document.storageKey);
};

/** If the course has a Course.syllabusDocumentId set, re-extracts that
 * document's own text (truncated the same way as the target document) for
 * generateSkeleton's syllabus-extraction mode. Returns null — never throws
 * — on any failure (no syllabus set, document missing, unreadable file):
 * generateCourseStructure falls back to inventing structure from the
 * target document, same as before this feature existed, rather than
 * failing the whole generation over a syllabus-specific problem. */
const resolveSyllabusText = async (courseId: string): Promise<string | null> => {
  const course = await courseRepository.findById(courseId);
  if (!course?.syllabusDocumentId) return null;

  try {
    const syllabusDocument = await documentRepository.findById(course.syllabusDocumentId);
    if (!syllabusDocument) return null;
    const syllabusBuffer = await readDocumentBuffer(syllabusDocument);
    const syllabusFullText = await extractDocumentText(syllabusDocument.filename, syllabusBuffer);
    return syllabusFullText.slice(0, env.MAX_LLM_SOURCE_CHARS);
  } catch (err) {
    logger.warn(
      { err, courseId, syllabusDocumentId: course.syllabusDocumentId },
      'Could not read the syllabus document; falling back to inventing structure from the target document',
    );
    return null;
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

    const fileBuffer = await readDocumentBuffer(document);
    const fullText = await extractDocumentText(document.filename, fileBuffer);
    // A single chapter-sized PDF fits comfortably within MAX_LLM_SOURCE_CHARS;
    // a whole textbook in one upload doesn't (known limitation — see design
    // doc, not solved here).
    const sourceText = fullText.slice(0, env.MAX_LLM_SOURCE_CHARS);

    const syllabusText = await resolveSyllabusText(courseId);
    const skeleton = await generateSkeleton(sourceText, syllabusText);

    // Phase 2 — one call per module, sequential rather than parallel: this is
    // already several Groq calls for one generation, and firing them
    // concurrently risks bursting past rate limits for no real benefit (this
    // is a teacher-triggered, infrequent action, not a latency-critical one).
    const modulesWithContent: { title: string; lessons: { title: string; keyTopics: string[]; content: string }[] }[] = [];
    for (const generatedModule of skeleton.modules) {
      const contentByLessonTitle = await generateModuleContent(
        documentId,
        sourceText,
        generatedModule.title,
        generatedModule.lessons,
      );
      const lessonsWithContent = generatedModule.lessons.map((lesson) => ({
        ...lesson,
        content: contentByLessonTitle.get(lesson.title) ?? placeholderContent(lesson),
      }));
      modulesWithContent.push({ title: generatedModule.title, lessons: lessonsWithContent });
    }

    const startOrderIndex = (await moduleRepository.maxOrderIndex(courseId)) + 1;

    const createdModules = await sequelize.transaction(async (transaction) => {
      const modules: Module[] = [];
      for (const [moduleOffset, generatedModule] of modulesWithContent.entries()) {
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

/** Powers the teacher/admin batch picker for viewing a course's
 * completed-course history (Gradebook/Assignments/Quizzes' batchId query
 * param) — see docs/superpowers/specs/2026-08-13-completed-course-history-design.md. */
export const listCourseBatches = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { courseId } = req.validated?.params as { courseId: string };
    const batches = await listBatchesForCourse(courseId);
    return ok(res, batches.map(serializeBatch), 'Batches retrieved');
  },
);
