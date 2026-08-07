import { registry, z } from './registry.js';
import { envelope } from './user.response.js';

const unauthenticated = { description: 'Not authenticated' };
const adminOnly = { description: 'Caller is not an admin' };

export const createExamTermSchema = {
  body: z.object({
    name: z.string().min(1, 'Name is required'),
    academicYearId: z.uuid(),
  }),
};

export const listExamTermsSchema = {
  query: z.object({ academicYearId: z.uuid().optional() }),
};

export const deleteExamTermSchema = {
  params: z.object({ id: z.uuid() }),
};

export const examTermSchema = registry.register(
  'ExamTerm',
  z.object({
    id: z.uuid(),
    name: z.string(),
    academicYearId: z.uuid(),
    createdAt: z.iso.datetime(),
  }),
);

registry.registerPath({
  method: 'post',
  path: '/exam-terms',
  tags: ['Exam Marks'],
  request: { body: { content: { 'application/json': { schema: createExamTermSchema.body } } } },
  responses: {
    201: {
      description: 'Exam term created (e.g. "First Terminal", "Preboard", "Re-exam") — the schedule teachers enter marks against',
      content: { 'application/json': { schema: envelope(examTermSchema) } },
    },
    400: { description: 'Validation failed' },
    401: unauthenticated,
    403: adminOnly,
    404: { description: 'Academic year not found' },
  },
});

registry.registerPath({
  method: 'get',
  path: '/exam-terms',
  tags: ['Exam Marks'],
  request: { query: listExamTermsSchema.query },
  responses: {
    200: {
      description: 'Every exam term, optionally filtered to one academic year — readable by any authenticated role so teachers can pick a term to enter marks against',
      content: { 'application/json': { schema: envelope(z.array(examTermSchema)) } },
    },
    401: unauthenticated,
  },
});

registry.registerPath({
  method: 'delete',
  path: '/exam-terms/{id}',
  tags: ['Exam Marks'],
  request: { params: deleteExamTermSchema.params },
  responses: {
    200: { description: 'Exam term deleted — every mark entered against it is deleted too' },
    401: unauthenticated,
    403: adminOnly,
    404: { description: 'Exam term not found' },
  },
});
