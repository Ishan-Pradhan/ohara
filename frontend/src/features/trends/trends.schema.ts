import { z } from 'zod';

export const gradeTrendPointSchema = z.object({
  date: z.string(),
  score: z.number(),
  maxScore: z.number(),
  title: z.string(),
  type: z.enum(['assignment', 'quiz']),
});

export const attendanceTrendPointSchema = z.object({
  date: z.string(),
  present: z.number(),
  absent: z.number(),
  late: z.number(),
  total: z.number(),
});

export type GradeTrendPoint = z.infer<typeof gradeTrendPointSchema>;
export type AttendanceTrendPoint = z.infer<typeof attendanceTrendPointSchema>;
