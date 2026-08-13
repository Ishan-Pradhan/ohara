import { registry, z } from './registry.js';
import { envelope } from './user.response.js';

const unauthenticated = { description: 'Not authenticated' };
const forbidden = { description: 'Caller is not an enrolled student in this course' };

// ── LLM structured-output shapes (parsed before ever being stored) ─────────

export const generatedSummarySchema = z.object({
  summary: z.string().min(1),
  keyPoints: z.array(z.string().min(1)).min(1),
});

export const generatedFlashcardsSchema = z.object({
  cards: z.array(z.object({ front: z.string().min(1), back: z.string().min(1) })).min(1),
});

// ── Request shapes ──────────────────────────────────────────────────────────

export const courseIdParamSchema = {
  params: z.object({ courseId: z.uuid() }),
};

export const getStudyAidSchema = {
  params: z.object({ courseId: z.uuid() }),
  query: z.object({ lessonId: z.uuid().optional() }),
};

export const generateStudyAidSchema = {
  params: z.object({ courseId: z.uuid() }),
  body: z.object({ lessonId: z.uuid().optional() }),
};

export const explainConceptSchema = {
  params: z.object({ courseId: z.uuid() }),
  body: z.object({
    lessonId: z.uuid().optional(),
    topic: z.string().min(1, 'Topic is required').max(300, 'Keep the topic under 300 characters'),
  }),
};

// ── Response schemas (Swagger docs) ─────────────────────────────────────────

export const flashcardSchema = registry.register(
  'Flashcard',
  z.object({ front: z.string(), back: z.string() }),
);

export const studyAidSchema = registry.register(
  'CourseStudyAid',
  z.object({
    id: z.uuid(),
    courseId: z.uuid(),
    lessonId: z.uuid().nullable(),
    type: z.enum(['summary', 'flashcards']),
    content: z.union([
      z.object({ summary: z.string(), keyPoints: z.array(z.string()) }),
      z.object({ cards: z.array(flashcardSchema) }),
    ]),
    createdAt: z.iso.datetime(),
  }),
);

const studyAidResponse = {
  200: {
    description: 'Study aid retrieved or generated',
    content: { 'application/json': { schema: envelope(studyAidSchema) } },
  },
  400: { description: 'Nothing to generate from — no lessons and no knowledge-base document selected' },
  401: unauthenticated,
  403: forbidden,
  404: { description: 'Course or lesson not found' },
  502: { description: 'The LLM could not produce valid content after a retry' },
};

registry.registerPath({
  method: 'get',
  path: '/courses/{courseId}/study-aids/summary',
  tags: ['Study Aids'],
  request: { params: getStudyAidSchema.params, query: getStudyAidSchema.query },
  responses: {
    200: studyAidResponse[200],
    401: unauthenticated,
    403: forbidden,
    404: { description: 'Not generated yet' },
  },
});

registry.registerPath({
  method: 'post',
  path: '/courses/{courseId}/study-aids/summary',
  tags: ['Study Aids'],
  request: {
    params: generateStudyAidSchema.params,
    body: { content: { 'application/json': { schema: generateStudyAidSchema.body } } },
  },
  responses: studyAidResponse,
});

registry.registerPath({
  method: 'get',
  path: '/courses/{courseId}/study-aids/flashcards',
  tags: ['Study Aids'],
  request: { params: getStudyAidSchema.params, query: getStudyAidSchema.query },
  responses: {
    200: studyAidResponse[200],
    401: unauthenticated,
    403: forbidden,
    404: { description: 'Not generated yet' },
  },
});

registry.registerPath({
  method: 'post',
  path: '/courses/{courseId}/study-aids/flashcards',
  tags: ['Study Aids'],
  request: {
    params: generateStudyAidSchema.params,
    body: { content: { 'application/json': { schema: generateStudyAidSchema.body } } },
  },
  responses: studyAidResponse,
});

registry.registerPath({
  method: 'post',
  path: '/courses/{courseId}/study-aids/explain',
  tags: ['Study Aids'],
  request: {
    params: explainConceptSchema.params,
    body: { content: { 'application/json': { schema: explainConceptSchema.body } } },
  },
  responses: {
    200: {
      description: 'Explanation generated',
      content: { 'application/json': { schema: envelope(z.object({ explanation: z.string() })) } },
    },
    401: unauthenticated,
    403: forbidden,
    404: { description: 'Course or lesson not found' },
  },
});
