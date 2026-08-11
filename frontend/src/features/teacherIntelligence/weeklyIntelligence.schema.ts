import { z } from 'zod';

const weeklyInsightsSchema = z.object({
  highlights: z.array(z.string()),
  concerns: z.array(z.string()),
  recommendations: z.array(z.string()),
  summary: z.string(),
});

export const weeklySummarySchema = z.object({
  courseId: z.string(),
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
});

export type WeeklySummary = z.infer<typeof weeklySummarySchema>;
