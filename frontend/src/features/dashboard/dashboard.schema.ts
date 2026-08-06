import { z } from 'zod';

export const dashboardCourseSchema = z.object({
  id: z.string(),
  title: z.string(),
  code: z.string(),
});

export const upcomingItemSchema = z.object({
  type: z.enum(['assignment', 'quiz']),
  id: z.string(),
  courseId: z.string(),
  courseTitle: z.string(),
  title: z.string(),
  dueAt: z.string().nullable(),
});

export const recentGradeItemSchema = z.object({
  type: z.enum(['assignment', 'quiz']),
  id: z.string(),
  courseId: z.string(),
  courseTitle: z.string(),
  title: z.string(),
  score: z.number(),
  maxScore: z.number(),
  gradedAt: z.string(),
});

export const studentDashboardSchema = z.object({
  placed: z.boolean(),
  courses: z.array(dashboardCourseSchema),
  upcoming: z.array(upcomingItemSchema),
  recentGrades: z.array(recentGradeItemSchema),
  unreadNotificationCount: z.number(),
});

export type UpcomingItem = z.infer<typeof upcomingItemSchema>;
export type RecentGradeItem = z.infer<typeof recentGradeItemSchema>;
export type StudentDashboard = z.infer<typeof studentDashboardSchema>;
