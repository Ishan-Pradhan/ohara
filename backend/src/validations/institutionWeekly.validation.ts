import { registry, z } from './registry.js';
import { envelope } from './user.response.js';

const unauthenticated = { description: 'Not authenticated' };
const adminOnly = { description: 'Caller is not an admin' };

export const institutionWeeklyInsightsSchema = z.object({
  highlights: z.array(z.string()),
  concerns: z.array(z.string()),
  recommendations: z.array(z.string()),
  summary: z.string(),
});

const programSummarySchema = z.object({
  name: z.string(),
  averageGrade: z.number().nullable(),
  attendanceRate: z.number().nullable(),
  atRiskCount: z.number(),
});

const institutionWeeklySchema = registry.register(
  'InstitutionWeeklySummary',
  z.object({
    week: z.string(),
    totals: z.object({
      activeCourses: z.number(),
      totalStudents: z.number(),
      totalAtRisk: z.number(),
    }),
    attendance: z.object({
      sessionsThisWeek: z.number(),
      present: z.number(),
      absent: z.number(),
      late: z.number(),
      rate: z.number().nullable(),
    }),
    submissions: z.object({
      dueThisWeek: z.number(),
      submitted: z.number(),
      late: z.number(),
      missing: z.number(),
    }),
    quizzes: z.object({
      availableThisWeek: z.number(),
      attempts: z.number(),
      averageScore: z.number().nullable(),
    }),
    programSummaries: z.array(programSummarySchema),
    insights: institutionWeeklyInsightsSchema.nullable(),
    insightsGeneratedAt: z.iso.datetime().nullable(),
  }),
);

export const getInstitutionWeeklySchema = {};

registry.registerPath({
  method: 'get',
  path: '/admin/weekly-intelligence',
  tags: ['Institution Intelligence'],
  responses: {
    200: {
      description:
        'Institution-wide weekly intelligence summary. insights is whatever was last cached ' +
        '(or null if never generated) — always fast, never calls the LLM.',
      content: { 'application/json': { schema: envelope(institutionWeeklySchema) } },
    },
    401: unauthenticated,
    403: adminOnly,
  },
});

export const generateInstitutionWeeklyInsightsSchema = {};

registry.registerPath({
  method: 'post',
  path: '/admin/weekly-intelligence/insights',
  tags: ['Institution Intelligence'],
  responses: {
    200: {
      description:
        'Regenerates and caches fresh AI insights from the current week\'s institution-wide ' +
        'data — explicitly triggered, never automatic.',
      content: {
        'application/json': {
          schema: envelope(
            z.object({ insights: institutionWeeklyInsightsSchema, generatedAt: z.iso.datetime() }),
          ),
        },
      },
    },
    401: unauthenticated,
    403: adminOnly,
    502: { description: 'The LLM could not produce valid insights after a retry' },
  },
});
