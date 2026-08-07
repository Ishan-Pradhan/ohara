import { registry, z } from './registry.js';
import { envelope } from './user.response.js';

const unauthenticated = { description: 'Not authenticated' };
const adminOnly = { description: 'Caller is not an admin' };

export const getBulkExamMarksSchema = {
  query: z.object({
    classId: z.uuid(),
    batchId: z.uuid(),
    examTermId: z.uuid(),
  }),
};

const bulkExamMarkInputSchema = z.object({
  studentId: z.uuid(),
  courseId: z.uuid(),
  marksObtained: z.number().min(0),
  maxMarks: z.number().positive(),
});

export const upsertBulkExamMarksSchema = {
  body: z.object({
    examTermId: z.uuid(),
    marks: z.array(bulkExamMarkInputSchema),
  }),
};

const bulkStudentSchema = z.object({
  id: z.uuid(),
  name: z.string(),
});

const bulkCourseSchema = z.object({
  id: z.uuid(),
  title: z.string(),
});

const bulkExistingMarkSchema = z.object({
  studentId: z.uuid(),
  courseId: z.uuid(),
  marksObtained: z.number(),
  maxMarks: z.number(),
});

const bulkExamMarksResponseSchema = registry.register(
  'BulkExamMarksResponse',
  z.object({
    students: z.array(bulkStudentSchema),
    courses: z.array(bulkCourseSchema),
    marks: z.array(bulkExistingMarkSchema),
  }),
);

registry.registerPath({
  method: 'get',
  path: '/courses/exam-marks/bulk',
  tags: ['Exam Marks'],
  request: { query: getBulkExamMarksSchema.query },
  responses: {
    200: {
      description: 'Retrieve students, courses, and existing exam marks in bulk for a class, batch, and term',
      content: { 'application/json': { schema: envelope(bulkExamMarksResponseSchema) } },
    },
    401: unauthenticated,
    403: adminOnly,
  },
});

registry.registerPath({
  method: 'put',
  path: '/courses/exam-marks/bulk',
  tags: ['Exam Marks'],
  request: {
    body: { content: { 'application/json': { schema: upsertBulkExamMarksSchema.body } } },
  },
  responses: {
    200: {
      description: 'Bulk save exam marks for multiple students and courses',
      content: { 'application/json': { schema: envelope(z.object({ success: z.boolean() })) } },
    },
    401: unauthenticated,
    403: adminOnly,
  },
});
