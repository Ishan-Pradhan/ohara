import { registry, z } from './registry.js';
import { envelope } from './user.response.js';

const unauthenticated = { description: 'Not authenticated' };
const forbidden = {
  description: 'Caller is not an admin, a teacher assigned to this course, or a student enrolled in it',
};
const teacherOnly = { description: 'Caller is not an admin or a teacher assigned to this course' };

export const rubricSchema = z
  .array(
    z.object({
      criterion: z.string().min(1),
      maxPoints: z.number().positive(),
      description: z.string().optional(),
    }),
  )
  .min(1, 'At least one rubric criterion is required');

export const createAssignmentSchema = {
  params: z.object({ courseId: z.uuid() }),
  body: z.object({
    title: z.string().min(1, 'Title is required'),
    prompt: z.string().min(1, 'Prompt is required'),
    rubric: rubricSchema,
    dueAt: z.iso.datetime(),
  }),
};

export const updateAssignmentSchema = {
  params: z.object({ courseId: z.uuid(), id: z.uuid() }),
  body: z.object({
    title: z.string().min(1, 'Title is required').optional(),
    prompt: z.string().min(1, 'Prompt is required').optional(),
    rubric: rubricSchema.optional(),
    dueAt: z.iso.datetime().optional(),
  }),
};

export const listAssignmentsSchema = {
  params: z.object({ courseId: z.uuid() }),
};

export const getAssignmentSchema = {
  params: z.object({ courseId: z.uuid(), id: z.uuid() }),
};

export const deleteAssignmentSchema = {
  params: z.object({ courseId: z.uuid(), id: z.uuid() }),
};

export const rubricCriterionResponseSchema = z.object({
  criterion: z.string(),
  maxPoints: z.number(),
  description: z.string().optional(),
});

export const assignmentSchema = registry.register(
  'Assignment',
  z.object({
    id: z.uuid(),
    courseId: z.uuid(),
    title: z.string(),
    prompt: z.string(),
    rubric: z.array(rubricCriterionResponseSchema),
    dueAt: z.iso.datetime(),
    createdAt: z.iso.datetime(),
  }),
);

registry.registerPath({
  method: 'post',
  path: '/courses/{courseId}/assignments',
  tags: ['Assignments'],
  request: {
    params: createAssignmentSchema.params,
    body: { content: { 'application/json': { schema: createAssignmentSchema.body } } },
  },
  responses: {
    201: {
      description: 'Assignment created',
      content: { 'application/json': { schema: envelope(assignmentSchema) } },
    },
    400: { description: 'Validation failed' },
    401: unauthenticated,
    403: teacherOnly,
  },
});

registry.registerPath({
  method: 'get',
  path: '/courses/{courseId}/assignments',
  tags: ['Assignments'],
  request: { params: listAssignmentsSchema.params },
  responses: {
    200: {
      description: "A course's assignments, soonest due date first",
      content: { 'application/json': { schema: envelope(z.array(assignmentSchema)) } },
    },
    401: unauthenticated,
    403: forbidden,
  },
});

registry.registerPath({
  method: 'get',
  path: '/courses/{courseId}/assignments/{id}',
  tags: ['Assignments'],
  request: { params: getAssignmentSchema.params },
  responses: {
    200: {
      description: 'Assignment detail',
      content: { 'application/json': { schema: envelope(assignmentSchema) } },
    },
    401: unauthenticated,
    403: forbidden,
    404: { description: 'Assignment not found' },
  },
});

registry.registerPath({
  method: 'patch',
  path: '/courses/{courseId}/assignments/{id}',
  tags: ['Assignments'],
  request: {
    params: updateAssignmentSchema.params,
    body: { content: { 'application/json': { schema: updateAssignmentSchema.body } } },
  },
  responses: {
    200: {
      description: 'Assignment updated',
      content: { 'application/json': { schema: envelope(assignmentSchema) } },
    },
    401: unauthenticated,
    403: teacherOnly,
    404: { description: 'Assignment not found' },
  },
});

registry.registerPath({
  method: 'delete',
  path: '/courses/{courseId}/assignments/{id}',
  tags: ['Assignments'],
  request: { params: deleteAssignmentSchema.params },
  responses: {
    200: { description: 'Assignment (and its submissions/grades) deleted' },
    401: unauthenticated,
    403: teacherOnly,
    404: { description: 'Assignment not found' },
  },
});
