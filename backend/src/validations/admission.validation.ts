import { registry, z } from './registry.js';
import { envelope, userPublicSchema } from './user.response.js';
import { classMembershipSchema } from './placement.validation.js';

export const admitStudentSchema = {
  body: z.object({
    name: z.string().min(1, 'Name is required'),
    email: z.email('Invalid email'),
    sectionId: z.uuid(),
    batchId: z.uuid(),
    parentName: z.string().optional(),
    parentPhone: z.string().optional(),
    address: z.string().optional(),
    dateOfBirth: z.string().optional(),
    previousSchool: z.string().optional(),
    studentPhone: z.string().optional(),
  }),
};

/** Trimmed response shape used for schema-level expectations (e.g. shared
 * with the frontend); the actual endpoint documents its full response via
 * userPublicSchema/classMembershipSchema below since it returns the full
 * serialized DTOs, not this subset. */
export const admittedStudentSchema = z.object({
  student: z.object({
    id: z.string(),
    name: z.string(),
    email: z.string(),
  }),
  membership: z.object({
    id: z.string(),
    studentId: z.string(),
    sectionId: z.string(),
    classId: z.string(),
  }),
});

const unauthenticated = { description: 'Not authenticated' };
const forbidden = { description: 'Caller is not authorized' };

registry.registerPath({
  method: 'post',
  path: '/admin/students/admit',
  tags: ['Admission'],
  request: {
    body: { content: { 'application/json': { schema: admitStudentSchema.body } } },
  },
  responses: {
    201: {
      description:
        'Student account created and invited, placed into the section, auto-enrolled in the class\'s compulsory courses, and (if any KYC field was supplied) a student profile created',
      content: {
        'application/json': {
          schema: envelope(
            z.object({ student: userPublicSchema, membership: classMembershipSchema }),
          ),
        },
      },
    },
    400: { description: 'Validation failed, or email already exists' },
    401: unauthenticated,
    403: forbidden,
    404: { description: 'Section not found' },
  },
});
