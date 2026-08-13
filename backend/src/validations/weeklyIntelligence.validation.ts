import { registry, z } from './registry.js';
import { envelope } from './user.response.js';

const unauthenticated = { description: 'Not authenticated' };
const teacherOnly = { description: 'Caller is not an admin or a teacher assigned to this course' };

export const getWeeklySummarySchema = {
  params: z.object({ courseId: z.uuid() }),
};

export const weeklyInsightsSchema = z.object({
  highlights: z.array(z.string()),
  concerns: z.array(z.string()),
  recommendations: z.array(z.string()),
  summary: z.string(),
});

const weeklySummarySchema = registry.register(
  'WeeklySummary',
  z.object({
    courseId: z.uuid(),
    courseName: z.string(),
    week: z.string(),
    enrollmentCount: z.number(),
    attendance: z.object({
      sessions: z.number(),
      present: z.number(),
      absent: z.number(),
      late: z.number(),
      attendanceRate: z.number().nullable(),
    }),
    submissions: z.object({
      total: z.number(),
      submitted: z.number(),
      late: z.number(),
      onTime: z.number(),
      notSubmitted: z.number(),
    }),
    quizzes: z.object({
      total: z.number(),
      attempted: z.number(),
      averageScore: z.number().nullable(),
    }),
    atRiskStudents: z.array(
      z.object({
        name: z.string(),
        average: z.number().nullable(),
        attendance: z.number().nullable(),
        missingSubmissions: z.number(),
      }),
    ),
    classAverage: z.number().nullable(),
    insights: weeklyInsightsSchema.nullable(),
    insightsGeneratedAt: z.iso.datetime().nullable(),
  }),
);

registry.registerPath({
  method: 'get',
  path: '/courses/{courseId}/weekly-intelligence',
  tags: ['Teacher Intelligence'],
  request: { params: getWeeklySummarySchema.params },
  responses: {
    200: {
      description:
        'Weekly class intelligence summary with attendance, submissions, quizzes, and at-risk ' +
        'students. insights is whatever was last cached for this course (or null if never ' +
        'generated) — always fast, never calls the LLM.',
      content: { 'application/json': { schema: envelope(weeklySummarySchema) } },
    },
    401: unauthenticated,
    403: teacherOnly,
  },
});

export const generateWeeklySummaryInsightsSchema = {
  params: z.object({ courseId: z.uuid() }),
};

registry.registerPath({
  method: 'post',
  path: '/courses/{courseId}/weekly-intelligence/insights',
  tags: ['Teacher Intelligence'],
  request: { params: generateWeeklySummaryInsightsSchema.params },
  responses: {
    200: {
      description:
        'Regenerates and caches fresh AI insights from this course\'s current week data — ' +
        'explicitly triggered, never automatic.',
      content: {
        'application/json': {
          schema: envelope(z.object({ insights: weeklyInsightsSchema, generatedAt: z.iso.datetime() })),
        },
      },
    },
    401: unauthenticated,
    403: teacherOnly,
    404: { description: 'Course not found' },
    502: { description: 'The LLM could not produce valid insights after a retry' },
  },
});
