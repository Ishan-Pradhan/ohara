import { registry, z } from './registry.js';
import { envelope } from './user.response.js';
import { enrollmentSchema } from './placement.validation.js';

const unauthenticated = { description: 'Not authenticated' };
const forbidden = { description: 'Caller is not a student, or the course is not in their current semester' };

export const enrollInElectiveSchema = {
  params: z.object({ courseId: z.uuid() }),
};

export const dropElectiveSchema = {
  params: z.object({ courseId: z.uuid() }),
};

registry.registerPath({
  method: 'post',
  path: '/courses/{courseId}/enroll',
  tags: ['Placement'],
  request: { params: enrollInElectiveSchema.params },
  responses: {
    201: {
      description: 'Self-enrolled in the elective',
      content: { 'application/json': { schema: envelope(enrollmentSchema) } },
    },
    400: { description: 'Course is not an elective, already enrolled, or the elective is full' },
    401: unauthenticated,
    403: forbidden,
    404: { description: 'Course not found, or student is not currently placed' },
  },
});

registry.registerPath({
  method: 'delete',
  path: '/courses/{courseId}/enroll',
  tags: ['Placement'],
  request: { params: dropElectiveSchema.params },
  responses: {
    200: { description: 'Dropped the elective' },
    400: { description: 'Course is compulsory and cannot be dropped' },
    401: unauthenticated,
    403: forbidden,
    404: { description: 'Course not found, student not currently placed, or not enrolled' },
  },
});
