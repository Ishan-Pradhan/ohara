import { registry, z } from './registry.js';
import { envelope } from './user.response.js';

const unauthenticated = { description: 'Not authenticated' };

const birthdayPersonSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  dateOfBirth: z.string(),
  role: z.enum(['admin', 'teacher', 'student']),
  avatarUrl: z.string().nullable(),
  wishedToday: z.boolean(),
});

export const getTodayBirthdaysSchema = {};

export const sendBirthdayWishSchema = {
  body: z.object({
    studentIds: z.array(z.uuid()).min(1, 'At least one student is required'),
    message: z.string().min(1, 'A message is required').max(2000),
  }),
};

// ── OpenAPI paths ──────────────────────────────────────────────────────────

registry.registerPath({
  method: 'get',
  path: '/admin/birthdays/today',
  tags: ['Birthdays'],
  responses: {
    200: {
      description: 'Today\'s birthdays across all roles',
      content: { 'application/json': { schema: envelope(z.array(birthdayPersonSchema)) } },
    },
    401: unauthenticated,
  },
});

registry.registerPath({
  method: 'post',
  path: '/admin/birthdays/wish',
  tags: ['Birthdays'],
  request: {
    body: { content: { 'application/json': { schema: sendBirthdayWishSchema.body } } },
  },
  responses: {
    200: {
      description: 'Birthday wishes sent',
      content: {
        'application/json': {
          schema: envelope(z.object({ sent: z.number(), failed: z.number() })),
        },
      },
    },
    401: unauthenticated,
  },
});
