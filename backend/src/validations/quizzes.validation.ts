import { registry, z } from './registry.js';
import { envelope } from './user.response.js';

const unauthenticated = { description: 'Not authenticated' };
const forbidden = {
  description: 'Caller is not an admin, a teacher assigned to this course, or a student enrolled in it',
};
const teacherOnly = { description: 'Caller is not an admin or a teacher assigned to this course' };

// ── Request schemas ─────────────────────────────────────────────────────────

export const generateQuizSchema = {
  params: z.object({ courseId: z.uuid() }),
  body: z
    .object({
      title: z.string().min(1, 'Title is required'),
      lessonId: z.uuid().optional(),
      topic: z.string().min(1).optional(),
      numQuestions: z.coerce.number().int().min(1).max(20).default(5),
      types: z.array(z.enum(['mcq', 'short_answer'])).min(1).default(['mcq', 'short_answer']),
    })
    .refine((v) => !!v.lessonId || !!v.topic, {
      message: 'Provide either lessonId (to ground the quiz in a lesson) or a topic',
      path: ['topic'],
    }),
};

export const createQuizSchema = {
  params: z.object({ courseId: z.uuid() }),
  body: z.object({ title: z.string().min(1, 'Title is required') }),
};

export const listQuizzesSchema = {
  params: z.object({ courseId: z.uuid() }),
};

export const getQuizSchema = {
  params: z.object({ courseId: z.uuid(), id: z.uuid() }),
};

export const updateQuizSchema = {
  params: z.object({ courseId: z.uuid(), id: z.uuid() }),
  body: z.object({ title: z.string().min(1, 'Title is required').optional() }),
};

export const deleteQuizSchema = {
  params: z.object({ courseId: z.uuid(), id: z.uuid() }),
};

export const publishQuizSchema = {
  params: z.object({ courseId: z.uuid(), id: z.uuid() }),
  body: z.object({ status: z.enum(['draft', 'published']) }),
};

const mcqQuestionBody = z.object({
  type: z.literal('mcq'),
  prompt: z.string().min(1, 'Prompt is required'),
  options: z.array(z.string().min(1)).min(2).max(6),
  correctIndex: z.number().int().min(0),
  points: z.number().int().positive().default(1),
  orderIndex: z.number().int(),
});

const shortAnswerQuestionBody = z.object({
  type: z.literal('short_answer'),
  prompt: z.string().min(1, 'Prompt is required'),
  points: z.number().int().positive().default(1),
  orderIndex: z.number().int(),
});

export const createQuestionSchema = {
  params: z.object({ courseId: z.uuid(), quizId: z.uuid() }),
  body: z.discriminatedUnion('type', [mcqQuestionBody, shortAnswerQuestionBody]),
};

export const updateQuestionSchema = {
  params: z.object({ courseId: z.uuid(), quizId: z.uuid(), id: z.uuid() }),
  body: z.object({
    prompt: z.string().min(1).optional(),
    options: z.array(z.string().min(1)).min(2).max(6).optional(),
    correctIndex: z.number().int().min(0).optional(),
    points: z.number().int().positive().optional(),
    orderIndex: z.number().int().optional(),
  }),
};

export const deleteQuestionSchema = {
  params: z.object({ courseId: z.uuid(), quizId: z.uuid(), id: z.uuid() }),
};

// ── LLM output shape ─────────────────────────────────────────────────────────

const generatedMcqSchema = z.object({
  type: z.literal('mcq'),
  prompt: z.string().min(1),
  options: z.array(z.string().min(1)).min(2),
  correctIndex: z.number().int().min(0),
  points: z.number().int().positive().optional(),
});

const generatedShortAnswerSchema = z.object({
  type: z.literal('short_answer'),
  prompt: z.string().min(1),
  points: z.number().int().positive().optional(),
});

export const generatedQuizSchema = z.object({
  questions: z.array(z.discriminatedUnion('type', [generatedMcqSchema, generatedShortAnswerSchema])).min(1),
});

// ── Response schemas ─────────────────────────────────────────────────────────

export const questionSchema = registry.register(
  'Question',
  z.object({
    id: z.uuid(),
    quizId: z.uuid(),
    type: z.enum(['mcq', 'short_answer']),
    prompt: z.string(),
    options: z.array(z.string()).nullable(),
    correctIndex: z.number().nullable().optional(),
    points: z.number(),
    orderIndex: z.number(),
  }),
);

export const quizSchema = registry.register(
  'Quiz',
  z.object({
    id: z.uuid(),
    courseId: z.uuid(),
    title: z.string(),
    status: z.enum(['draft', 'published']),
    createdAt: z.iso.datetime(),
    questions: z.array(questionSchema).optional(),
  }),
);

// ── OpenAPI path registrations ───────────────────────────────────────────────

registry.registerPath({
  method: 'post',
  path: '/courses/{courseId}/quizzes/generate',
  tags: ['Quizzes'],
  request: {
    params: generateQuizSchema.params,
    body: {
      content: {
        'application/json': {
          schema: z.object({
            title: z.string(),
            lessonId: z.uuid().optional(),
            topic: z.string().optional(),
            numQuestions: z.number().default(5),
            types: z.array(z.enum(['mcq', 'short_answer'])).default(['mcq', 'short_answer']),
          }),
        },
      },
    },
  },
  responses: {
    201: {
      description: 'Draft quiz generated with questions',
      content: { 'application/json': { schema: envelope(quizSchema) } },
    },
    400: { description: 'Neither lessonId nor topic provided, or lessonId does not belong to this course' },
    401: unauthenticated,
    403: teacherOnly,
    502: { description: 'The LLM could not produce a valid quiz after a retry' },
  },
});

registry.registerPath({
  method: 'post',
  path: '/courses/{courseId}/quizzes',
  tags: ['Quizzes'],
  request: {
    params: createQuizSchema.params,
    body: { content: { 'application/json': { schema: createQuizSchema.body } } },
  },
  responses: {
    201: {
      description: 'Empty draft quiz created (questions added manually afterward)',
      content: { 'application/json': { schema: envelope(quizSchema) } },
    },
    401: unauthenticated,
    403: teacherOnly,
  },
});

registry.registerPath({
  method: 'get',
  path: '/courses/{courseId}/quizzes',
  tags: ['Quizzes'],
  request: { params: listQuizzesSchema.params },
  responses: {
    200: {
      description: "A course's quizzes — teachers/admins see draft and published, students see published only",
      content: { 'application/json': { schema: envelope(z.array(quizSchema)) } },
    },
    401: unauthenticated,
    403: forbidden,
  },
});

registry.registerPath({
  method: 'get',
  path: '/courses/{courseId}/quizzes/{id}',
  tags: ['Quizzes'],
  request: { params: getQuizSchema.params },
  responses: {
    200: {
      description: 'Quiz with questions — the correct answer is withheld from a student who has not yet attempted it',
      content: { 'application/json': { schema: envelope(quizSchema) } },
    },
    401: unauthenticated,
    403: forbidden,
    404: { description: 'Quiz not found, or not yet published (student caller)' },
  },
});

registry.registerPath({
  method: 'patch',
  path: '/courses/{courseId}/quizzes/{id}',
  tags: ['Quizzes'],
  request: {
    params: updateQuizSchema.params,
    body: { content: { 'application/json': { schema: updateQuizSchema.body } } },
  },
  responses: {
    200: {
      description: 'Quiz updated',
      content: { 'application/json': { schema: envelope(quizSchema) } },
    },
    401: unauthenticated,
    403: teacherOnly,
    404: { description: 'Quiz not found' },
  },
});

registry.registerPath({
  method: 'delete',
  path: '/courses/{courseId}/quizzes/{id}',
  tags: ['Quizzes'],
  request: { params: deleteQuizSchema.params },
  responses: {
    200: { description: 'Quiz (and its questions/attempts) deleted' },
    401: unauthenticated,
    403: teacherOnly,
    404: { description: 'Quiz not found' },
  },
});

registry.registerPath({
  method: 'patch',
  path: '/courses/{courseId}/quizzes/{id}/publish',
  tags: ['Quizzes'],
  request: {
    params: publishQuizSchema.params,
    body: { content: { 'application/json': { schema: publishQuizSchema.body } } },
  },
  responses: {
    200: { description: 'Quiz publish state updated' },
    401: unauthenticated,
    403: teacherOnly,
    404: { description: 'Quiz not found' },
  },
});

registry.registerPath({
  method: 'post',
  path: '/courses/{courseId}/quizzes/{quizId}/questions',
  tags: ['Quizzes'],
  request: {
    params: createQuestionSchema.params,
    body: { content: { 'application/json': { schema: createQuestionSchema.body } } },
  },
  responses: {
    201: {
      description: 'Question added',
      content: { 'application/json': { schema: envelope(questionSchema) } },
    },
    401: unauthenticated,
    403: teacherOnly,
    404: { description: 'Quiz not found' },
  },
});

registry.registerPath({
  method: 'patch',
  path: '/courses/{courseId}/quizzes/{quizId}/questions/{id}',
  tags: ['Quizzes'],
  request: {
    params: updateQuestionSchema.params,
    body: { content: { 'application/json': { schema: updateQuestionSchema.body } } },
  },
  responses: {
    200: {
      description: 'Question updated',
      content: { 'application/json': { schema: envelope(questionSchema) } },
    },
    401: unauthenticated,
    403: teacherOnly,
    404: { description: 'Question not found' },
  },
});

registry.registerPath({
  method: 'delete',
  path: '/courses/{courseId}/quizzes/{quizId}/questions/{id}',
  tags: ['Quizzes'],
  request: { params: deleteQuestionSchema.params },
  responses: {
    200: { description: 'Question deleted' },
    401: unauthenticated,
    403: teacherOnly,
    404: { description: 'Question not found' },
  },
});
