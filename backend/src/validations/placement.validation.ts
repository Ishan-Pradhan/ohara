import { registry, z } from './registry.js';
import { envelope } from './user.response.js';

const unauthenticated = { description: 'Not authenticated' };
const forbidden = { description: 'Caller is not authorized' };

// ── CLASS MEMBERSHIPS ───────────────────────────────────────────────────────

export const createClassMembershipSchema = {
  body: z.object({
    studentId: z.uuid(),
    sectionId: z.uuid(),
  }),
};

export const listClassMembershipsSchema = {
  query: z.object({
    studentId: z.uuid().optional(),
    sectionId: z.uuid().optional(),
    academicYearId: z.uuid().optional(),
  }),
};

export const classMembershipSchema = registry.register(
  'ClassMembership',
  z.object({
    id: z.uuid(),
    studentId: z.uuid(),
    sectionId: z.uuid(),
    academicYearId: z.uuid(),
    outcome: z.enum(['enrolled', 'promoted', 'retained', 'graduated']),
    promotedToId: z.uuid().nullable(),
    createdAt: z.iso.datetime(),
  }),
);

registry.registerPath({
  method: 'post',
  path: '/admin/class-memberships',
  tags: ['Placement'],
  request: {
    body: {
      content: { 'application/json': { schema: createClassMembershipSchema.body } },
    },
  },
  responses: {
    201: {
      description: 'Class membership created',
      content: { 'application/json': { schema: envelope(classMembershipSchema) } },
    },
    400: {
      description:
        'Validation failed, studentId is not a student, or already placed for this academic year',
    },
    401: unauthenticated,
    403: forbidden,
    404: { description: 'Student or section not found' },
  },
});

registry.registerPath({
  method: 'get',
  path: '/admin/class-memberships',
  tags: ['Placement'],
  request: { query: listClassMembershipsSchema.query },
  responses: {
    200: {
      description: 'List of class memberships',
      content: {
        'application/json': { schema: envelope(z.array(classMembershipSchema)) },
      },
    },
    401: unauthenticated,
    403: forbidden,
  },
});
