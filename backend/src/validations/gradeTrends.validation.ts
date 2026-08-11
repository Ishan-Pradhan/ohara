import { registry, z } from './registry.js';
import { envelope } from './user.response.js';

const unauthenticated = { description: 'Not authenticated' };
const forbidden = { description: 'Caller does not have access to this course' };

export const getGradeTrendsSchema = {
  params: z.object({ courseId: z.uuid() }),
};

const gradeTrendPointSchema = z.object({
  date: z.string(),
  score: z.number(),
  maxScore: z.number(),
  title: z.string(),
  type: z.enum(['assignment', 'quiz']),
});

export const gradeTrendsSchema = registry.register(
  'GradeTrends',
  z.array(gradeTrendPointSchema),
);

registry.registerPath({
  method: 'get',
  path: '/courses/{courseId}/grade-trends',
  tags: ['Grade Trends'],
  request: { params: getGradeTrendsSchema.params },
  responses: {
    200: {
      description: 'Grade data points ordered by date for trend charting',
      content: { 'application/json': { schema: envelope(gradeTrendsSchema) } },
    },
    401: unauthenticated,
    403: forbidden,
  },
});
