import { registry, z } from './registry.js';
import { envelope } from './user.response.js';

const unauthenticated = { description: 'Not authenticated' };
const teacherOnly = { description: 'Caller is not an admin or a teacher assigned to this course' };
const studentOnly = { description: 'Caller is not a student enrolled in this course' };

export const getGradebookSchema = {
  params: z.object({ courseId: z.uuid() }),
  // Omitted -> the course's current batch (unchanged default). Given -> a
  // specific past batch's gradebook, for viewing completed-course history.
  query: z.object({ batchId: z.uuid().optional() }),
};

export const getMyGradesSchema = {
  params: z.object({ courseId: z.uuid() }),
};

const gradebookEntrySchema = z.object({
  assessmentId: z.uuid(),
  type: z.enum(['assignment', 'quiz']),
  score: z.number().nullable(),
  maxScore: z.number(),
  status: z.enum(['graded', 'pending', 'ungraded', 'not_submitted', 'not_attempted']),
});

const gradebookAssessmentSchema = z.object({
  id: z.uuid(),
  type: z.enum(['assignment', 'quiz']),
  title: z.string(),
  maxScore: z.number(),
});

const gradebookRowSchema = z.object({
  studentId: z.uuid(),
  studentName: z.string(),
  entries: z.array(gradebookEntrySchema),
  totalScore: z.number(),
  totalMaxScore: z.number(),
  average: z.number().nullable(),
});

export const gradebookSchema = registry.register(
  'Gradebook',
  z.object({
    assessments: z.array(gradebookAssessmentSchema),
    rows: z.array(gradebookRowSchema),
  }),
);

registry.registerPath({
  method: 'get',
  path: '/courses/{courseId}/gradebook',
  tags: ['Gradebook'],
  request: { params: getGradebookSchema.params, query: getGradebookSchema.query },
  responses: {
    200: {
      description:
        'Every enrolled student x every assignment/published quiz, approved grades and auto-scored quiz attempts only (FR-30). Optional batchId views a specific past batch\'s gradebook (completed-course history); omitted defaults to the current batch.',
      content: { 'application/json': { schema: envelope(gradebookSchema) } },
    },
    401: unauthenticated,
    403: teacherOnly,
  },
});

registry.registerPath({
  method: 'get',
  path: '/courses/{courseId}/gradebook/me',
  tags: ['Gradebook'],
  request: { params: getMyGradesSchema.params },
  responses: {
    200: {
      description: "The caller's own row from the course gradebook",
      content: { 'application/json': { schema: envelope(gradebookRowSchema.nullable()) } },
    },
    401: unauthenticated,
    403: studentOnly,
  },
});
