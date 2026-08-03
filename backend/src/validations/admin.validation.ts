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
  }),
};

export const archiveUserSchema = {
  params: z.object({ id: uuid }),
};

export const hardDeleteUserSchema = {
  params: z.object({ id: uuid }),
  body: z.object({ confirmHardDelete: z.literal(true) }),
};

// ── OpenAPI path registrations ─────────────────────────────────────────────

import { registry } from './registry.js';
import { envelope, userPublicSchema } from './user.response.js';

const forbidden = { description: 'Caller is not an admin' };
const unauthenticated = { description: 'Not authenticated' };

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
