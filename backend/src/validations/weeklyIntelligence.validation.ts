import { registry, z } from './registry.js';
import { envelope } from './user.response.js';

const unauthenticated = { description: 'Not authenticated' };
const teacherOnly = { description: 'Caller is not an admin or a teacher assigned to this course' };

export const getWeeklySummarySchema = {
  params: z.object({ courseId: z.uuid() }),
};

const weeklyInsightsSchema = z.object({
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
  }),
);

registry.registerPath({
  method: 'get',
  path: '/courses/{courseId}/weekly-intelligence',
  tags: ['Teacher Intelligence'],
  request: { params: getWeeklySummarySchema.params },
  responses: {
    200: {
      description: 'Weekly class intelligence summary with attendance, submissions, quizzes, at-risk students, and AI insights',
      content: { 'application/json': { schema: envelope(weeklySummarySchema) } },
    },
    401: unauthenticated,
    403: teacherOnly,
  },
});
