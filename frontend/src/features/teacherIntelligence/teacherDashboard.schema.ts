import { z } from 'zod';

const dashboardInsightsSchema = z.object({
  highlights: z.array(z.string()),
  concerns: z.array(z.string()),
  recommendations: z.array(z.string()),
  summary: z.string(),
});

const courseSummarySchema = z.object({
  courseId: z.string(),
  courseName: z.string(),
  enrollmentCount: z.number(),
  classAverage: z.number().nullable(),
  attendanceRate: z.number().nullable(),
  atRiskCount: z.number(),
  topPerformers: z.array(
    z.object({ studentId: z.string(), studentName: z.string(), average: z.number().nullable() }),
  ),
  bottomPerformers: z.array(
    z.object({ studentId: z.string(), studentName: z.string(), average: z.number().nullable() }),
  ),
});

export const teacherDashboardSchema = z.object({
  totalCourses: z.number(),
  totalStudents: z.number(),
  totalAtRisk: z.number(),
  courses: z.array(courseSummarySchema),
  insights: dashboardInsightsSchema.nullable(),
  insightsGeneratedAt: z.string().nullable(),
});

export const generatedInsightsSchema = z.object({
  insights: dashboardInsightsSchema,
  generatedAt: z.string(),
});

export type TeacherDashboard = z.infer<typeof teacherDashboardSchema>;
export type DashboardInsights = z.infer<typeof dashboardInsightsSchema>;
