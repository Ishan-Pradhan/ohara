import { registry, z } from './registry.js';
import { envelope } from './user.response.js';

const unauthenticated = { description: 'Not authenticated' };

export const dashboardInsightsSchema = z.object({
  highlights: z.array(z.string()),
  concerns: z.array(z.string()),
  recommendations: z.array(z.string()),
  summary: z.string(),
});

const courseSummarySchema = z.object({
  courseId: z.uuid(),
  courseName: z.string(),
  enrollmentCount: z.number(),
  classAverage: z.number().nullable(),
  attendanceRate: z.number().nullable(),
  atRiskCount: z.number(),
  topPerformers: z.array(
    z.object({ studentId: z.uuid(), studentName: z.string(), average: z.number().nullable() }),
  ),
  bottomPerformers: z.array(
    z.object({ studentId: z.uuid(), studentName: z.string(), average: z.number().nullable() }),
  ),
});

const teacherDashboardSchema = registry.register(
  'TeacherDashboard',
  z.object({
    totalCourses: z.number(),
    totalStudents: z.number(),
    totalAtRisk: z.number(),
    courses: z.array(courseSummarySchema),
    insights: dashboardInsightsSchema.nullable(),
    insightsGeneratedAt: z.iso.datetime().nullable(),
  }),
);

export const getTeacherDashboardSchema = {};

registry.registerPath({
  method: 'get',
  path: '/teacher/dashboard',
  tags: ['Teacher Intelligence'],
  responses: {
    200: {
      description:
        'Teacher dashboard overview across all assigned courses. insights is whatever was last ' +
        'cached (or null if never generated) — always fast, never calls the LLM.',
      content: { 'application/json': { schema: envelope(teacherDashboardSchema) } },
    },
    401: unauthenticated,
  },
});

export const generateTeacherDashboardInsightsSchema = {};

registry.registerPath({
  method: 'post',
  path: '/teacher/dashboard/insights',
  tags: ['Teacher Intelligence'],
  responses: {
    200: {
      description:
        'Regenerates and caches fresh AI insights from the teacher\'s current course data — ' +
        'explicitly triggered, never automatic, same principle as At-Risk explanations.',
      content: { 'application/json': { schema: envelope(z.object({ insights: dashboardInsightsSchema, generatedAt: z.iso.datetime() })) } },
    },
    401: unauthenticated,
    502: { description: 'The LLM could not produce valid insights after a retry' },
  },
});
