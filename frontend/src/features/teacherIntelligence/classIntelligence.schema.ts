import { z } from 'zod';

const performerSchema = z.object({
  studentId: z.string(),
  studentName: z.string(),
  average: z.number(),
});

export const classIntelligenceSchema = z.object({
  courseId: z.string(),
  enrollmentCount: z.number(),
  activeStudents: z.number(),
  classAverage: z.number().nullable(),
  attendanceRate: z.number().nullable(),
  submissionCompletionRate: z.number().nullable(),
  atRiskCount: z.number(),
  topPerformers: z.array(performerSchema),
  bottomPerformers: z.array(performerSchema),
});

export type ClassIntelligence = z.infer<typeof classIntelligenceSchema>;
