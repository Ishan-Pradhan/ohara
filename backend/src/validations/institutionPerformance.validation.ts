import { registry, z } from './registry.js';
import { envelope } from './user.response.js';

const unauthenticated = { description: 'Not authenticated' };
const adminOnly = { description: 'Caller is not an admin' };

export const institutionPerformanceInsightsSchema = z.object({
  highlights: z.array(z.string()),
  concerns: z.array(z.string()),
  recommendations: z.array(z.string()),
  summary: z.string(),
});

const programSummarySchema = z.object({
  name: z.string(),
  courseCount: z.number(),
  studentCount: z.number(),
  averageGrade: z.number().nullable(),
  attendanceRate: z.number().nullable(),
  atRiskCount: z.number(),
});

const courseSummarySchema = z.object({
  courseId: z.uuid(),
  name: z.string(),
  averageGrade: z.number().nullable(),
  enrollmentCount: z.number(),
});

const institutionPerformanceSchema = registry.register(
  'InstitutionPerformance',
  z.object({
    totals: z.object({
      programs: z.number(),
      classes: z.number(),
      courses: z.number(),
      students: z.number(),
      teachers: z.number(),
      activeEnrollments: z.number(),
    }),
    academic: z.object({
      overallAverageGrade: z.number().nullable(),
      overallAttendanceRate: z.number().nullable(),
      totalAtRisk: z.number(),
      atRiskRate: z.number().nullable(),
      totalSubmissions: z.number(),
      totalMissingSubmissions: z.number(),
    }),
    programs: z.array(programSummarySchema),
    topCourses: z.array(courseSummarySchema),
    bottomCourses: z.array(courseSummarySchema),
    insights: institutionPerformanceInsightsSchema.nullable(),
    insightsGeneratedAt: z.iso.datetime().nullable(),
  }),
);

export const getInstitutionPerformanceSchema = {};

registry.registerPath({
  method: 'get',
  path: '/admin/institution-performance',
  tags: ['Institution Intelligence'],
  responses: {
    200: {
      description:
        'Institution-wide academic performance overview. insights is whatever was last cached ' +
        '(or null if never generated) — always fast, never calls the LLM.',
      content: { 'application/json': { schema: envelope(institutionPerformanceSchema) } },
    },
    401: unauthenticated,
    403: adminOnly,
  },
});

export const generateInstitutionPerformanceInsightsSchema = {};

registry.registerPath({
  method: 'post',
  path: '/admin/institution-performance/insights',
  tags: ['Institution Intelligence'],
  responses: {
    200: {
      description:
        'Regenerates and caches fresh AI insights from current institution-wide data — ' +
        'explicitly triggered, never automatic.',
      content: {
        'application/json': {
          schema: envelope(
            z.object({ insights: institutionPerformanceInsightsSchema, generatedAt: z.iso.datetime() }),
          ),
        },
      },
    },
    401: unauthenticated,
    403: adminOnly,
    502: { description: 'The LLM could not produce valid insights after a retry' },
  },
});
