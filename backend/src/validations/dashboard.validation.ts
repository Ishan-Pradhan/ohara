import { registry, z } from './registry.js';
import { envelope } from './user.response.js';

const courseSummarySchema = z.object({ id: z.uuid(), title: z.string(), code: z.string() });

const upcomingItemSchema = z.object({
  type: z.enum(['assignment', 'quiz']),
  id: z.uuid(),
  courseId: z.uuid(),
  courseTitle: z.string(),
  title: z.string(),
  dueAt: z.iso.datetime().nullable(),
});

const recentGradeItemSchema = z.object({
  type: z.enum(['assignment', 'quiz']),
  id: z.uuid(),
  courseId: z.uuid(),
  courseTitle: z.string(),
  title: z.string(),
  score: z.number(),
  maxScore: z.number(),
  gradedAt: z.iso.datetime(),
});

const studentDashboardSchema = registry.register(
  'StudentDashboard',
  z.object({
    placed: z.boolean(),
    courses: z.array(courseSummarySchema),
    upcoming: z.array(upcomingItemSchema),
    recentGrades: z.array(recentGradeItemSchema),
    unreadNotificationCount: z.number(),
  }),
);

registry.registerPath({
  method: 'get',
  path: '/dashboard/me',
  tags: ['Dashboard'],
  responses: {
    200: {
      description:
        "The student's dashboard: enrolled courses, work not yet done, recently approved grades, and unread notification count",
      content: { 'application/json': { schema: envelope(studentDashboardSchema) } },
    },
    401: { description: 'Not authenticated' },
    403: { description: 'Caller is not a student' },
  },
});
