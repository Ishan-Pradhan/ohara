import { registry, z } from './registry.js';
import { envelope } from './user.response.js';

const unauthenticated = { description: 'Not authenticated' };
const forbidden = { description: 'Caller is not an admin' };

// ── PROGRAMS ────────────────────────────────────────────────────────────────

export const createProgramSchema = {
  body: z.object({
    name: z.string().min(1, 'Name is required'),
    institutionType: z.enum(['school', 'college', 'university']),
    description: z.string().optional(),
  }),
};

export const programSchema = registry.register(
  'Program',
  z.object({
    id: z.uuid(),
    name: z.string(),
    institutionType: z.enum(['school', 'college', 'university']),
    description: z.string().nullable(),
    createdAt: z.iso.datetime(),
  }),
);

registry.registerPath({
  method: 'post',
  path: '/admin/programs',
  tags: ['Institution'],
  request: {
    body: {
      content: { 'application/json': { schema: createProgramSchema.body } },
    },
  },
  responses: {
    201: {
      description: 'Program created',
      content: { 'application/json': { schema: envelope(programSchema) } },
    },
    400: { description: 'Validation failed' },
    401: unauthenticated,
    403: forbidden,
  },
});

registry.registerPath({
  method: 'get',
  path: '/admin/programs',
  tags: ['Institution'],
  responses: {
    200: {
      description: 'List of programs',
      content: {
        'application/json': { schema: envelope(z.array(programSchema)) },
      },
    },
    401: unauthenticated,
    403: forbidden,
  },
});
