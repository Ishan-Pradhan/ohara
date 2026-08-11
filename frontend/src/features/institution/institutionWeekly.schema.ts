import { z } from 'zod';

const insightsSchema = z.object({
  highlights: z.array(z.string()),
  concerns: z.array(z.string()),
  recommendations: z.array(z.string()),
  summary: z.string(),
});

const programSummarySchema = z.object({
  name: z.string(),
  averageGrade: z.number().nullable(),
  attendanceRate: z.number().nullable(),
  atRiskCount: z.number(),
});

export const institutionWeeklySchema = z.object({
  week: z.string(),
  totals: z.object({
    activeCourses: z.number(),
    totalStudents: z.number(),
    totalAtRisk: z.number(),
  }),
  attendance: z.object({
    sessionsThisWeek: z.number(),
    present: z.number(),
    absent: z.number(),
    late: z.number(),
    rate: z.number().nullable(),
  }),
  submissions: z.object({
    dueThisWeek: z.number(),
    submitted: z.number(),
    late: z.number(),
    missing: z.number(),
  }),
  quizzes: z.object({
    availableThisWeek: z.number(),
    attempts: z.number(),
    averageScore: z.number().nullable(),
  }),
  programSummaries: z.array(programSummarySchema),
  insights: insightsSchema.nullable(),
});

export type InstitutionWeekly = z.infer<typeof institutionWeeklySchema>;
