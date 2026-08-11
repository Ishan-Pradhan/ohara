import { registry, z } from './registry.js';
import { envelope } from './user.response.js';

const unauthenticated = { description: 'Not authenticated' };

export const getMyProfileSchema = {};

export const updateMyProfileSchema = {
  body: z.object({
    parentName: z.string().min(1).nullable().optional(),
    parentPhone: z.string().min(1).nullable().optional(),
    address: z.string().min(1).nullable().optional(),
    dateOfBirth: z.string().nullable().optional(),
    previousSchool: z.string().min(1).nullable().optional(),
    studentPhone: z.string().min(1).nullable().optional(),
  }),
};

const studentProfileSchema = registry.register(
  'StudentProfile',
  z.object({
    id: z.uuid(),
    userId: z.uuid(),
    parentName: z.string().nullable(),
    parentPhone: z.string().nullable(),
    address: z.string().nullable(),
    dateOfBirth: z.string().nullable(),
    previousSchool: z.string().nullable(),
    studentPhone: z.string().nullable(),
    createdAt: z.string(),
    updatedAt: z.string(),
  }),
);

registry.registerPath({
  method: 'get',
  path: '/students/me/profile',
  tags: ['Student Profile'],
  responses: {
    200: {
      description: "The current student's profile data",
      content: { 'application/json': { schema: envelope(studentProfileSchema.nullable()) } },
    },
    401: unauthenticated,
  },
});

registry.registerPath({
  method: 'patch',
  path: '/students/me/profile',
  tags: ['Student Profile'],
  request: {
    body: { content: { 'application/json': { schema: updateMyProfileSchema.body } } },
  },
  responses: {
    200: {
      description: 'Updated student profile',
      content: { 'application/json': { schema: envelope(studentProfileSchema) } },
    },
    401: unauthenticated,
  },
});
