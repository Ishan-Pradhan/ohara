import { z } from './registry.js';

const uuid = z.uuid('Invalid UUID');


export const toggleBlockUserSchema = {
    params: z.object({
        id: uuid,
    }),
};

export const getAllUsersSchema = {
  query: z.object({
    page: z.string().optional(),
    limit: z.string().optional(),
    search: z.string().optional(),
    role: z.enum(['admin', 'teacher', 'student', 'alumni']).optional(),
  }),
};

export const getUserSchema = {
  params: z.object({ id: uuid }),
};

export const archiveUserSchema = {
  params: z.object({ id: uuid }),
};

export const restoreUserSchema = {
  params: z.object({ id: uuid }),
};

export const setDateOfBirthSchema = {
  params: z.object({ id: uuid }),
  body: z.object({ dateOfBirth: z.iso.date() }),
};

/** Not `userPublicSchema` — a student's DOB lives on `StudentProfile`, not
 * `users.dateOfBirth` (that column is teacher/admin-only), so the response
 * reports the id + value actually written rather than the whole user. */
export const dateOfBirthResultSchema = z.object({
  id: z.uuid(),
  dateOfBirth: z.iso.date(),
});

// Students self-register (auth.controller.ts); teacher and admin accounts
// only ever come from here — there is deliberately no role picker at
// self-registration.
export const createStaffSchema = {
  body: z.object({
    name: z.string().min(1, 'Name is required'),
    email: z.email('Invalid email'),
    role: z.enum(['teacher', 'admin']),
  }),
};

export const hardDeleteUserSchema = {
  params: z.object({ id: uuid }),
  body: z.object({ confirmHardDelete: z.literal(true) }),
};

// One request, one role — "invite this class of students" or "invite these
// two new teachers." Capped at 200 rows: each row hashes a placeholder
// password and sends an email, so an unbounded batch is a real request-time cost.
export const inviteUsersBatchSchema = {
  body: z.object({
    role: z.enum(['teacher', 'admin', 'student']),
    users: z
      .array(
        z.object({
          name: z.string().min(1, 'Name is required'),
          email: z.email('Invalid email'),
        }),
      )
      .min(1, 'Add at least one person')
      .max(200, 'Invite at most 200 at a time'),
  }),
};

// ── OpenAPI path registrations ─────────────────────────────────────────────

import { registry } from './registry.js';
import { envelope, userPublicSchema } from './user.response.js';

const forbidden = { description: 'Caller is not an admin' };
const unauthenticated = { description: 'Not authenticated' };

registry.registerPath({
  method: 'get',
  path: '/admin/users/{id}',
  tags: ['Admin'],
  request: { params: getUserSchema.params },
  responses: {
    200: {
      description: 'A single user — powers the Staff detail page (any role)',
      content: { 'application/json': { schema: envelope(userPublicSchema) } },
    },
    401: unauthenticated,
    403: forbidden,
    404: { description: 'User not found' },
  },
});

registry.registerPath({
  method: 'get',
  path: '/admin/users',
  tags: ['Admin'],
  request: {
    query: getAllUsersSchema.query,
  },
  responses: {
    200: {
      description: 'Paginated list of users',
      content: {
        'application/json': {
          schema: envelope(z.array(userPublicSchema)),
        },
      },
    },
    401: unauthenticated,
    403: forbidden,
  },
});

registry.registerPath({
  method: 'post',
  path: '/admin/users',
  tags: ['Admin'],
  request: {
    body: { content: { 'application/json': { schema: createStaffSchema.body } } },
  },
  responses: {
    201: {
      description:
        'Teacher or admin account created (unverified) and sent a set-password email',
      content: { 'application/json': { schema: envelope(userPublicSchema) } },
    },
    400: { description: 'Email already exists or validation failed' },
    401: unauthenticated,
    403: forbidden,
  },
});

registry.registerPath({
  method: 'post',
  path: '/admin/users/batch',
  tags: ['Admin'],
  request: {
    body: { content: { 'application/json': { schema: inviteUsersBatchSchema.body } } },
  },
  responses: {
    201: {
      description:
        'Per-row results — invited accounts (unverified, set-password email sent) and skipped rows with a reason (e.g. duplicate email)',
      content: {
        'application/json': {
          schema: envelope(
            z.object({
              invited: z.array(userPublicSchema),
              skipped: z.array(z.object({ email: z.string(), reason: z.string() })),
            }),
          ),
        },
      },
    },
    400: { description: 'Validation failed' },
    401: unauthenticated,
    403: forbidden,
  },
});

registry.registerPath({
  method: 'get',
  path: '/admin/stats',
  tags: ['Admin'],
  responses: {
    200: {
      description: 'Aggregate user counts',
      content: {
        'application/json': {
          schema: envelope(
            z.object({
              totalUsers: z.number(),
              blockedCount: z.number(),
              adminsCount: z.number(),
            }),
          ),
        },
      },
    },
    401: unauthenticated,
    403: forbidden,
  },
});

registry.registerPath({
  method: 'patch',
  path: '/admin/toggle-block/{id}',
  tags: ['Admin'],
  request: { params: toggleBlockUserSchema.params },
  responses: {
    200: {
      description: 'Block state toggled',
      content: { 'application/json': { schema: envelope(userPublicSchema) } },
    },
    401: unauthenticated,
    403: forbidden,
    404: { description: 'User not found' },
  },
});

registry.registerPath({
  method: 'patch',
  path: '/admin/users/{id}/archive',
  tags: ['Admin'],
  request: { params: archiveUserSchema.params },
  responses: {
    200: {
      description:
        'User archived (soft removal — access revoked, academic record preserved)',
      content: { 'application/json': { schema: envelope(userPublicSchema) } },
    },
    401: unauthenticated,
    403: forbidden,
    404: { description: 'User not found' },
  },
});

registry.registerPath({
  method: 'patch',
  path: '/admin/users/{id}/restore',
  tags: ['Admin'],
  request: { params: restoreUserSchema.params },
  responses: {
    200: {
      description:
        'User restored (un-archived) — an archived/inactive student is returned to active with login access',
      content: { 'application/json': { schema: envelope(userPublicSchema) } },
    },
    400: { description: 'User is not a student, or is graduated (not reversible)' },
    401: unauthenticated,
    403: forbidden,
    404: { description: 'User not found' },
  },
});

registry.registerPath({
  method: 'patch',
  path: '/admin/users/{id}/date-of-birth',
  tags: ['Admin'],
  request: {
    params: setDateOfBirthSchema.params,
    body: { content: { 'application/json': { schema: setDateOfBirthSchema.body } } },
  },
  responses: {
    200: {
      description: "The user's date of birth set (feeds the admin birthday calendar)",
      content: { 'application/json': { schema: envelope(dateOfBirthResultSchema) } },
    },
    401: unauthenticated,
    403: forbidden,
    404: { description: 'User not found' },
  },
});

registry.registerPath({
  method: 'delete',
  path: '/admin/users/{id}',
  tags: ['Admin'],
  request: {
    params: hardDeleteUserSchema.params,
    body: { content: { 'application/json': { schema: hardDeleteUserSchema.body } } },
  },
  responses: {
    200: { description: 'User permanently deleted' },
    401: unauthenticated,
    403: forbidden,
    404: { description: 'User not found' },
    409: {
      description:
        'User still has academic records (class memberships/enrollments) and cannot be hard-deleted',
    },
  },
});
