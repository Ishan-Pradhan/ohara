import { z } from 'zod';

export const atRiskRowSchema = z.object({
  studentId: z.string(),
  studentName: z.string(),
  averageGrade: z.number().nullable(),
  attendancePercentage: z.number().nullable(),
  missingSubmissions: z.number(),
  lateSubmissions: z.number(),
  isAtRisk: z.boolean(),
});

export type AtRiskRow = z.infer<typeof atRiskRowSchema>;
