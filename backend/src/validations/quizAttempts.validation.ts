import { registry, z } from './registry.js';
import { envelope } from './user.response.js';

const unauthenticated = { description: 'Not authenticated' };
const studentOnly = { description: 'Caller is not a student enrolled in this course' };
const teacherOnly = { description: 'Caller is not an admin or a teacher assigned to this course' };

export const submitAttemptSchema = {
  params: z.object({ courseId: z.uuid(), id: z.uuid() }),
  body: z.object({
    responses: z
      .array(z.object({ questionId: z.uuid(), answer: z.union([z.number(), z.string()]) }))
      .min(1),
  }),
};

export const getMyAttemptSchema = {
  params: z.object({ courseId: z.uuid(), id: z.uuid() }),
};

export const listAttemptsSchema = {
  params: z.object({ courseId: z.uuid(), id: z.uuid() }),
};

export const gradeShortAnswerSchema = {
  params: z.object({ courseId: z.uuid(), id: z.uuid(), attemptId: z.uuid(), questionId: z.uuid() }),
};

export const gradeAllShortAnswersSchema = {
  params: z.object({ courseId: z.uuid(), id: z.uuid() }),
};

export const editShortAnswerGradeSchema = {
  params: z.object({ courseId: z.uuid(), id: z.uuid(), attemptId: z.uuid(), questionId: z.uuid() }),
  body: z.object({
    awardedPoints: z.number().nonnegative(),
    feedback: z.string().nullable().optional(),
    status: z.enum(['draft', 'approved']).optional(),
  }),
};

// ── LLM output shape ─────────────────────────────────────────────────────────

export const gradedShortAnswerSchema = z.object({
  awardedPoints: z.number().nonnegative(),
  feedback: z.string(),
});

// ── Response schemas ─────────────────────────────────────────────────────────

export const shortAnswerGradeSchema = registry.register(
  'ShortAnswerGrade',
  z.object({
    id: z.uuid(),
    questionId: z.uuid(),
    awardedPoints: z.number(),
    maxPoints: z.number(),
    feedback: z.string().nullable(),
    status: z.enum(['draft', 'approved']),
  }),
);

export const attemptResultSchema = z.object({
  questionId: z.uuid(),
  type: z.enum(['mcq', 'short_answer']),
  answer: z.union([z.number(), z.string()]),
  correct: z.boolean().nullable(),
  correctIndex: z.number().nullable().optional(),
  points: z.number(),
  grade: z
    .object({
      status: z.enum(['ungraded', 'draft', 'approved']),
      awardedPoints: z.number().nullable(),
      maxPoints: z.number().nullable(),
      feedback: z.string().nullable(),
    })
    .nullable(),
});

export const quizAttemptSchema = registry.register(
  'QuizAttempt',
  z.object({
    id: z.uuid(),
    quizId: z.uuid(),
    studentId: z.uuid(),
    student: z.object({ id: z.uuid(), name: z.string(), email: z.string() }).optional(),
    score: z.number(),
    maxScore: z.number(),
    submittedAt: z.iso.datetime(),
    results: z.array(attemptResultSchema),
  }),
);

registry.registerPath({
  method: 'post',
  path: '/courses/{courseId}/quizzes/{id}/attempts',
  tags: ['Quiz Attempts'],
  request: {
    params: submitAttemptSchema.params,
    body: { content: { 'application/json': { schema: submitAttemptSchema.body } } },
  },
  responses: {
    201: {
      description: 'Attempt scored (MCQs auto-scored; short-answer stays ungraded until a teacher AI-grades and approves it)',
      content: { 'application/json': { schema: envelope(quizAttemptSchema) } },
    },
    400: { description: 'A response references a question that is not on this quiz' },
    401: unauthenticated,
    403: studentOnly,
    404: { description: 'Quiz not found or not published' },
    409: { description: 'This student has already attempted this quiz' },
  },
});

registry.registerPath({
  method: 'get',
  path: '/courses/{courseId}/quizzes/{id}/attempts/me',
  tags: ['Quiz Attempts'],
  request: { params: getMyAttemptSchema.params },
  responses: {
    200: {
      description: "The caller's own attempt, or null if not yet attempted",
      content: { 'application/json': { schema: envelope(quizAttemptSchema.nullable()) } },
    },
    401: unauthenticated,
    403: studentOnly,
  },
});

registry.registerPath({
  method: 'get',
  path: '/courses/{courseId}/quizzes/{id}/attempts',
  tags: ['Quiz Attempts'],
  request: { params: listAttemptsSchema.params },
  responses: {
    200: {
      description: 'Every attempt on this quiz, for the teacher roster view',
      content: { 'application/json': { schema: envelope(z.array(quizAttemptSchema)) } },
    },
    401: unauthenticated,
    403: teacherOnly,
  },
});

registry.registerPath({
  method: 'post',
  path: '/courses/{courseId}/quizzes/{id}/attempts/{attemptId}/questions/{questionId}/grade',
  tags: ['Quiz Attempts'],
  request: { params: gradeShortAnswerSchema.params },
  responses: {
    200: {
      description: 'AI draft grade generated (or regenerated) for this short-answer response',
      content: { 'application/json': { schema: envelope(shortAnswerGradeSchema) } },
    },
    400: { description: 'This student did not answer that question' },
    401: unauthenticated,
    403: teacherOnly,
    404: { description: 'Attempt or short-answer question not found' },
    409: { description: 'Grade is already approved' },
    502: { description: 'The LLM could not produce a valid grade after a retry' },
  },
});

registry.registerPath({
  method: 'post',
  path: '/courses/{courseId}/quizzes/{id}/grade-short-answers',
  tags: ['Quiz Attempts'],
  request: { params: gradeAllShortAnswersSchema.params },
  responses: {
    200: {
      description: 'AI draft grading run for every ungraded short-answer response across all attempts; per-response failures are reported, not thrown',
    },
    401: unauthenticated,
    403: teacherOnly,
  },
});

registry.registerPath({
  method: 'patch',
  path: '/courses/{courseId}/quizzes/{id}/attempts/{attemptId}/questions/{questionId}/grade',
  tags: ['Quiz Attempts'],
  request: {
    params: editShortAnswerGradeSchema.params,
    body: { content: { 'application/json': { schema: editShortAnswerGradeSchema.body } } },
  },
  responses: {
    200: {
      description: "Teacher's edited grade, optionally approved in the same call",
      content: { 'application/json': { schema: envelope(shortAnswerGradeSchema) } },
    },
    401: unauthenticated,
    403: teacherOnly,
    404: { description: 'No grade exists yet for this response — run AI grading first' },
  },
});
