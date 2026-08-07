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

export const performanceEvidenceSchema = z.object({
  courses: z.number(),
  assessments: z.number(),
  gradedAssessments: z.number(),
  completedAssessments: z.number(),
  attendanceRecords: z.number(),
});

export const performanceCourseSchema = z.object({
  courseId: z.string(),
  courseTitle: z.string(),
  status: z.enum(['ready', 'insufficient_data']),
  averageGrade: z.number().nullable(),
  attendancePercentage: z.number().nullable(),
  completionRate: z.number().nullable(),
  missingSubmissions: z.number(),
  lateSubmissions: z.number(),
  evidence: performanceEvidenceSchema.omit({ courses: true }),
});

export const performanceSnapshotSchema = z.object({
  status: z.enum(['ready', 'insufficient_data']),
  averageGrade: z.number().nullable(),
  attendancePercentage: z.number().nullable(),
  completionRate: z.number().nullable(),
  missingSubmissions: z.number(),
  lateSubmissions: z.number(),
  evidence: performanceEvidenceSchema,
  courses: z.array(performanceCourseSchema),
});

export const studentDashboardSchema = z.object({
  placed: z.boolean(),
  courses: z.array(dashboardCourseSchema),
  upcoming: z.array(upcomingItemSchema),
  recentGrades: z.array(recentGradeItemSchema),
  performance: performanceSnapshotSchema,
  unreadNotificationCount: z.number(),
});

export type UpcomingItem = z.infer<typeof upcomingItemSchema>;
export type RecentGradeItem = z.infer<typeof recentGradeItemSchema>;
export type PerformanceEvidence = z.infer<typeof performanceEvidenceSchema>;
export type PerformanceCourse = z.infer<typeof performanceCourseSchema>;
export type PerformanceSnapshot = z.infer<typeof performanceSnapshotSchema>;
export type StudentDashboard = z.infer<typeof studentDashboardSchema>;
