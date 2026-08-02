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
