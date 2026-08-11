import { registry, z } from './registry.js';
import { envelope } from './user.response.js';

const unauthenticated = { description: 'Not authenticated' };

const dashboardInsightsSchema = z.object({
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
  }),
);

export const getTeacherDashboardSchema = {};

registry.registerPath({
  method: 'get',
  path: '/teacher/dashboard',
  tags: ['Teacher Intelligence'],
  responses: {
    200: {
      description: 'Teacher dashboard overview across all assigned courses',
      content: { 'application/json': { schema: envelope(teacherDashboardSchema) } },
    },
    401: unauthenticated,
  },
});
