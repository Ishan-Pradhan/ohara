import { registry, z } from './registry.js';
import { envelope } from './user.response.js';

const unauthenticated = { description: 'Not authenticated' };
const adminOnly = { description: 'Caller is not an admin' };

const insightsSchema = z.object({
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
    insights: insightsSchema.nullable(),
  }),
);

export const getInstitutionPerformanceSchema = {};

registry.registerPath({
  method: 'get',
  path: '/admin/institution-performance',
  tags: ['Institution Intelligence'],
  responses: {
    200: {
      description: 'Institution-wide academic performance overview with AI insights',
      content: { 'application/json': { schema: envelope(institutionPerformanceSchema) } },
    },
    401: unauthenticated,
    403: adminOnly,
  },
});
