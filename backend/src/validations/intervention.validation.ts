import { registry, z } from './registry.js';
import { envelope } from './user.response.js';

const unauthenticated = { description: 'Not authenticated' };
const teacherOnly = { description: 'Caller is not an admin or a teacher assigned to this course' };

// --- Intervention CRUD ---

export const createInterventionSchema = {
  params: z.object({ courseId: z.uuid() }),
  body: z.object({
    studentId: z.uuid(),
    type: z.enum(['manual', 'meeting', 'tutoring', 'other']),
    title: z.string().min(1).max(200),
    notes: z.string().min(1).max(2000),
    actions: z
      .array(
        z.object({
          description: z.string(),
          timeline: z.string(),
          resources: z.string().optional(),
        }),
      )
      .optional()
      .default([]),
  }),
};

export const generateInterventionSchema = {
  params: z.object({ courseId: z.uuid(), studentId: z.uuid() }),
};

export const getInterventionsSchema = {
  params: z.object({ courseId: z.uuid() }),
  query: z.object({ studentId: z.uuid().optional() }),
};

export const getInterventionSchema = {
  params: z.object({ courseId: z.uuid(), id: z.uuid() }),
};

export const updateInterventionSchema = {
  params: z.object({ courseId: z.uuid(), id: z.uuid() }),
  body: z.object({
    title: z.string().min(1).max(200).optional(),
    notes: z.string().min(1).max(2000).optional(),
    status: z.enum(['active', 'resolved', 'dismissed']).optional(),
    actions: z
      .array(
        z.object({
          description: z.string(),
          timeline: z.string(),
          resources: z.string().optional(),
        }),
      )
      .optional(),
  }),
};

export const resolveInterventionSchema = {
  params: z.object({ courseId: z.uuid(), id: z.uuid() }),
};

export const deleteInterventionSchema = {
  params: z.object({ courseId: z.uuid(), id: z.uuid() }),
};

export const getInterventionOutcomeSchema = {
  params: z.object({ courseId: z.uuid(), id: z.uuid() }),
};

const interventionActionSchema = z.object({
  description: z.string(),
  timeline: z.string(),
  resources: z.string().optional(),
});

const interventionSchema = registry.register(
  'Intervention',
  z.object({
    id: z.uuid(),
    studentId: z.uuid(),
    courseId: z.uuid(),
    teacherId: z.uuid(),
    type: z.enum(['ai_generated', 'manual', 'meeting', 'tutoring', 'other']),
    title: z.string(),
    notes: z.string(),
    actions: z.array(interventionActionSchema),
    status: z.enum(['active', 'resolved', 'dismissed']),
    resolvedAt: z.iso.datetime().nullable(),
    createdAt: z.iso.datetime(),
    student: z.object({ id: z.uuid(), name: z.string(), email: z.string() }).nullable(),
    teacher: z.object({ id: z.uuid(), name: z.string(), email: z.string() }).nullable(),
  }),
);

registry.registerPath({
  method: 'get',
  path: '/courses/{courseId}/interventions',
  tags: ['Interventions'],
  request: {
    params: getInterventionsSchema.params,
    query: getInterventionsSchema.query,
  },
  responses: {
    200: {
      description: 'List of interventions for a course, optionally filtered by student',
      content: { 'application/json': { schema: envelope(z.array(interventionSchema)) } },
    },
    401: unauthenticated,
    403: teacherOnly,
  },
});

registry.registerPath({
  method: 'post',
  path: '/courses/{courseId}/interventions',
  tags: ['Interventions'],
  request: {
    params: createInterventionSchema.params,
    body: { content: { 'application/json': { schema: createInterventionSchema.body } } },
  },
  responses: {
    201: {
      description: 'Intervention created',
      content: { 'application/json': { schema: envelope(interventionSchema) } },
    },
    401: unauthenticated,
    403: teacherOnly,
  },
});

registry.registerPath({
  method: 'post',
  path: '/courses/{courseId}/interventions/generate/{studentId}',
  tags: ['Interventions'],
  request: { params: generateInterventionSchema.params },
  responses: {
    200: {
      description: 'AI-generated intervention plan persisted for a student',
      content: { 'application/json': { schema: envelope(interventionSchema) } },
    },
    401: unauthenticated,
    403: teacherOnly,
    404: { description: 'Student not enrolled in this course' },
  },
});

const interventionOutcomeSchema = z.object({
  hasOutcome: z.boolean(),
  reason: z.string().optional(),
  interventionId: z.uuid().optional(),
  status: z.enum(['active', 'resolved', 'dismissed']).optional(),
  resolvedAt: z.iso.datetime().nullable().optional(),
  metrics: z
    .object({
      averageGrade: z.object({ before: z.number().nullable(), after: z.number().nullable(), change: z.number(), trend: z.enum(['improved', 'declined', 'stable']) }),
      attendancePercentage: z.object({ before: z.number().nullable(), after: z.number().nullable(), change: z.number(), trend: z.enum(['improved', 'declined', 'stable']) }),
      missingSubmissions: z.object({ before: z.number(), after: z.number(), change: z.number(), trend: z.enum(['improved', 'declined', 'stable']) }),
      lateSubmissions: z.object({ before: z.number(), after: z.number(), change: z.number(), trend: z.enum(['improved', 'declined', 'stable']) }),
      isAtRisk: z.object({ before: z.boolean(), after: z.boolean(), resolved: z.boolean() }),
    })
    .optional(),
});

registry.registerPath({
  method: 'get',
  path: '/courses/{courseId}/interventions/{id}/outcome',
  tags: ['Interventions'],
  request: { params: getInterventionOutcomeSchema.params },
  responses: {
    200: {
      description: 'Intervention outcome analysis comparing metrics before and after',
      content: { 'application/json': { schema: envelope(interventionOutcomeSchema) } },
    },
    401: unauthenticated,
    403: teacherOnly,
    404: { description: 'Intervention not found' },
  },
});
