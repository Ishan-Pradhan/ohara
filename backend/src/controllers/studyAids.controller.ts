import type { Response } from 'express';
import type { AuthRequest } from '../types/auth.types.js';
import { courseRepository } from '../repositories/courses.repository.js';
import { moduleRepository } from '../repositories/modules.repository.js';
import { lessonRepository } from '../repositories/lessons.repository.js';
import { documentChunkRepository } from '../repositories/documentChunks.repository.js';
import { courseStudyAidRepository } from '../repositories/courseStudyAids.repository.js';
import { retrieveKnowledgeBaseMaterial } from './documents.controller.js';
import { embed } from '../services/embeddings.service.js';
import { generateJson, generateText } from '../services/llm.service.js';
import {
  studyAidSummarySystemPrompt,
  studyAidSummaryUserPrompt,
  studyAidSummaryCorrectivePrompt,
  studyAidFlashcardsSystemPrompt,
  studyAidFlashcardsUserPrompt,
  studyAidFlashcardsCorrectivePrompt,
  explainConceptSystemPrompt,
  explainConceptUserPrompt,
} from '../prompts/studyAids.prompt.js';
import { generatedSummarySchema, generatedFlashcardsSchema } from '../validations/studyAids.validation.js';
import { serializeCourseStudyAid } from '../serializers/courseStudyAid.serializer.js';
import { STUDY_AID_TYPES } from '../types/courseStudyAids.types.js';
import type { StudyAidType, StudyAidContent } from '../types/courseStudyAids.types.js';
import {
  TUTOR_RETRIEVAL_K,
  TUTOR_RELEVANCE_MAX_DISTANCE,
  STUDY_AID_SOURCE_MAX_CHARS,
  STUDY_AID_SUMMARY_MAX_COMPLETION_TOKENS,
  STUDY_AID_FLASHCARDS_MAX_COMPLETION_TOKENS,
} from '../constants/index.js';
import { asyncHandler } from '../utils/AsyncHandler.js';
import { ok } from '../utils/ApiResponse.js';
import { ApiError } from '../utils/ApiError.js';

interface SourceResolution {
  text: string;
  label: string;
}

/** Regenerating deletes and replaces the single row every enrolled student
 * reads from (see generateSummary/generateFlashcards below) — letting any
 * student trigger it would let one student silently pull the material out
 * from under everyone else mid-study, with no way to get the old version
 * back. Only the course's own teacher or an admin may do it. A student may
 * still trigger the very first generation (regenerate falsy), which only
 * ever creates, never destroys, anything. */
const assertRegeneratePermitted = (req: AuthRequest) => {
  if (req.user!.role !== 'admin' && req.user!.role !== 'teacher') {
    throw new ApiError(
      403,
      'Only a teacher or admin can regenerate this — it would replace what every enrolled student is currently studying from.',
    );
  }
};

/** Lesson-scoped: the lesson's own already-curated content is the source —
 * no RAG needed, it's on-topic by construction. Course-wide: every lesson's
 * content aggregated (cheap, already curated by course-structure
 * generation) if any exist; otherwise the knowledge-base document's chunks
 * directly, same fallback quiz/lesson-planner generation already use. `null`
 * means genuinely nothing to generate from (course has neither lessons nor
 * a selected knowledge-base document) — the caller 400s rather than letting
 * the LLM invent content from nothing. */
const resolveSourceText = async (
  courseId: string,
  knowledgeBaseDocumentId: string | null,
  lessonId: string | null,
): Promise<SourceResolution | null> => {
  if (lessonId) {
    const lesson = await lessonRepository.findById(lessonId);
    if (!lesson) return null;
    const module = await moduleRepository.findById(lesson.moduleId);
    if (!module || module.courseId !== courseId) return null;
    const text = `Lesson: ${lesson.title}\nKey topics: ${lesson.keyTopics.join(', ')}\n\n${lesson.content}`.slice(
      0,
      STUDY_AID_SOURCE_MAX_CHARS,
    );
    return { text, label: `the lesson "${lesson.title}"` };
  }

  const modules = await moduleRepository.findAllByCourse(courseId);
  const lessonTexts: string[] = [];
  for (const module of modules) {
    const lessons = await lessonRepository.findAllByModule(module.id);
    for (const lesson of lessons) {
      lessonTexts.push(`## ${lesson.title}\n${lesson.content}`);
    }
  }
  if (lessonTexts.length > 0) {
    return { text: lessonTexts.join('\n\n').slice(0, STUDY_AID_SOURCE_MAX_CHARS), label: 'the course' };
  }

  const material = await retrieveKnowledgeBaseMaterial(
    knowledgeBaseDocumentId,
    'course overview, key topics, and main concepts',
    15,
  );
  if (!material) return null;
  return { text: material, label: 'the course' };
};

/** "Explain a concept," lesson-scoped: the lesson's own content is already
 * a small, on-topic unit — no relevance threshold needed, unlike the
 * course-wide path below. */
const resolveLessonSourceText = async (
  courseId: string,
  lessonId: string,
): Promise<SourceResolution | null> => {
  const lesson = await lessonRepository.findById(lessonId);
  if (!lesson) return null;
  const module = await moduleRepository.findById(lesson.moduleId);
  if (!module || module.courseId !== courseId) return null;
  return {
    text: `Lesson: ${lesson.title}\n\n${lesson.content}`.slice(0, STUDY_AID_SOURCE_MAX_CHARS),
    label: lesson.title,
  };
};

/** "Explain a concept," course-wide: driven by a student-typed free-text
 * topic rather than a teacher-chosen one, so it needs the same
 * relevance-threshold protection the tutor's own search_course_material
 * tool has (fixed 2026-08-12 for the tutor) — only chunks within
 * TUTOR_RELEVANCE_MAX_DISTANCE of the topic count as "covers this".
 * Otherwise a student asking about something the course doesn't teach would
 * still get chunks back, and the LLM might answer from outside knowledge
 * despite the prompt telling it not to. */
const findRelevantChunksForTopic = async (
  knowledgeBaseDocumentId: string | null,
  topic: string,
): Promise<string | null> => {
  if (!knowledgeBaseDocumentId) return null;
  const [queryVector] = await embed([topic]);
  if (!queryVector) return null;
  const chunks = await documentChunkRepository.findSimilar(
    knowledgeBaseDocumentId,
    queryVector,
    TUTOR_RETRIEVAL_K,
    TUTOR_RELEVANCE_MAX_DISTANCE,
  );
  if (chunks.length === 0) return null;
  return chunks.map((c) => c.content).join('\n\n---\n\n');
};

const getCourseOrThrow = async (courseId: string) => {
  const course = await courseRepository.findById(courseId);
  if (!course) throw new ApiError(404, 'Course not found');
  return course;
};

// ── Summary ─────────────────────────────────────────────────────────────

const tryParseSummary = (raw: string) => {
  try {
    return generatedSummarySchema.safeParse(JSON.parse(raw));
  } catch {
    return { success: false as const };
  }
};

export const getSummary = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { courseId } = req.validated?.params as { courseId: string };
  const { lessonId } = req.validated?.query as { lessonId?: string };
  const aid = await courseStudyAidRepository.findOne(courseId, lessonId ?? null, STUDY_AID_TYPES.SUMMARY);
  if (!aid) throw new ApiError(404, 'No summary generated yet');
  return ok(res, serializeCourseStudyAid(aid), 'Summary retrieved');
});

export const generateSummary = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { courseId } = req.validated?.params as { courseId: string };
  const { lessonId, regenerate } = req.validated?.body as { lessonId?: string; regenerate?: boolean };
  const userId = req.user!.id;

  if (regenerate) {
    assertRegeneratePermitted(req);
    await courseStudyAidRepository.delete(courseId, lessonId ?? null, STUDY_AID_TYPES.SUMMARY);
  } else {
    const cached = await courseStudyAidRepository.findOne(courseId, lessonId ?? null, STUDY_AID_TYPES.SUMMARY);
    if (cached) {
      return ok(res, serializeCourseStudyAid(cached), 'Summary retrieved');
    }
  }

  const course = await getCourseOrThrow(courseId);
  const source = await resolveSourceText(courseId, course.knowledgeBaseDocumentId, lessonId ?? null);
  if (!source) {
    throw new ApiError(400, 'Nothing to summarize yet — no lessons and no knowledge-base document selected for this course');
  }

  const systemPrompt = studyAidSummarySystemPrompt;
  const userPrompt = studyAidSummaryUserPrompt(source.label, source.text);
  const raw = await generateJson(systemPrompt, userPrompt, STUDY_AID_SUMMARY_MAX_COMPLETION_TOKENS);
  let parsed = tryParseSummary(raw);
  if (!parsed.success) {
    const retryRaw = await generateJson(
      systemPrompt,
      studyAidSummaryCorrectivePrompt(raw),
      STUDY_AID_SUMMARY_MAX_COMPLETION_TOKENS,
    );
    parsed = tryParseSummary(retryRaw);
  }
  if (!parsed.success) {
    throw new ApiError(502, 'The LLM could not produce a valid summary after a retry');
  }

  const aid = await courseStudyAidRepository.create({
    courseId,
    lessonId: lessonId ?? null,
    type: STUDY_AID_TYPES.SUMMARY,
    content: parsed.data as StudyAidContent,
    generatedBy: userId,
  });
  return ok(res, serializeCourseStudyAid(aid), 'Summary generated', 201);
});

// ── Flashcards ──────────────────────────────────────────────────────────

const tryParseFlashcards = (raw: string) => {
  try {
    return generatedFlashcardsSchema.safeParse(JSON.parse(raw));
  } catch {
    return { success: false as const };
  }
};

export const getFlashcards = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { courseId } = req.validated?.params as { courseId: string };
  const { lessonId } = req.validated?.query as { lessonId?: string };
  const aid = await courseStudyAidRepository.findOne(courseId, lessonId ?? null, STUDY_AID_TYPES.FLASHCARDS);
  if (!aid) throw new ApiError(404, 'No flashcards generated yet');
  return ok(res, serializeCourseStudyAid(aid), 'Flashcards retrieved');
});

export const generateFlashcards = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { courseId } = req.validated?.params as { courseId: string };
  const { lessonId, regenerate } = req.validated?.body as { lessonId?: string; regenerate?: boolean };
  const userId = req.user!.id;

  if (regenerate) {
    assertRegeneratePermitted(req);
    await courseStudyAidRepository.delete(courseId, lessonId ?? null, STUDY_AID_TYPES.FLASHCARDS);
  } else {
    const cached = await courseStudyAidRepository.findOne(courseId, lessonId ?? null, STUDY_AID_TYPES.FLASHCARDS);
    if (cached) {
      return ok(res, serializeCourseStudyAid(cached), 'Flashcards retrieved');
    }
  }

  const course = await getCourseOrThrow(courseId);
  const source = await resolveSourceText(courseId, course.knowledgeBaseDocumentId, lessonId ?? null);
  if (!source) {
    throw new ApiError(400, 'Nothing to make flashcards from yet — no lessons and no knowledge-base document selected for this course');
  }

  const systemPrompt = studyAidFlashcardsSystemPrompt;
  const userPrompt = studyAidFlashcardsUserPrompt(source.label, source.text);
  const raw = await generateJson(systemPrompt, userPrompt, STUDY_AID_FLASHCARDS_MAX_COMPLETION_TOKENS);
  let parsed = tryParseFlashcards(raw);
  if (!parsed.success) {
    const retryRaw = await generateJson(
      systemPrompt,
      studyAidFlashcardsCorrectivePrompt(raw),
      STUDY_AID_FLASHCARDS_MAX_COMPLETION_TOKENS,
    );
    parsed = tryParseFlashcards(retryRaw);
  }
  if (!parsed.success) {
    throw new ApiError(502, 'The LLM could not produce valid flashcards after a retry');
  }

  const aid = await courseStudyAidRepository.create({
    courseId,
    lessonId: lessonId ?? null,
    type: STUDY_AID_TYPES.FLASHCARDS,
    content: parsed.data as StudyAidContent,
    generatedBy: userId,
  });
  return ok(res, serializeCourseStudyAid(aid), 'Flashcards generated', 201);
});

// ── Explain a concept ───────────────────────────────────────────────────

/** Ephemeral — never persisted. Unlike summary/flashcards, a free-text topic
 * varies too much per student to meaningfully cache and reuse. */
export const explainConcept = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { courseId } = req.validated?.params as { courseId: string };
  const { lessonId, topic } = req.validated?.body as { lessonId?: string; topic: string };

  const course = await getCourseOrThrow(courseId);

  const source = lessonId
    ? await resolveLessonSourceText(courseId, lessonId)
    : await findRelevantChunksForTopic(course.knowledgeBaseDocumentId, topic).then((text) =>
        text ? { text, label: 'the course' } : null,
      );

  if (!source) {
    return ok(
      res,
      { explanation: "The material doesn't cover this topic." },
      'Explanation generated',
    );
  }

  const explanation = await generateText(
    explainConceptSystemPrompt,
    explainConceptUserPrompt(topic, source.text),
  );
  return ok(res, { explanation }, 'Explanation generated');
});

export type { StudyAidType };
