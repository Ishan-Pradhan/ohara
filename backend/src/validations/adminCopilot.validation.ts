import { registry, z } from './registry.js';
import { envelope } from './user.response.js';

const unauthenticated = { description: 'Not authenticated' };
const adminOnly = { description: 'Caller is not an admin' };

export const adminCopilotQuerySchema = {
  body: z.object({
    question: z.string().min(1).max(500),
  }),
};

const copilotResponseSchema = registry.register(
  'AdminCopilotResponse',
  z.object({
    answer: z.string(),
    dataContext: z.string(),
  }),
);

registry.registerPath({
  method: 'post',
  path: '/admin/copilot/query',
  tags: ['Institution Intelligence'],
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({ question: z.string() }),
        },
      },
    },
  },
  responses: {
    200: {
      description: 'AI-generated answer about institution academic data',
      content: { 'application/json': { schema: envelope(copilotResponseSchema) } },
    },
    401: unauthenticated,
    403: adminOnly,
  },
});
