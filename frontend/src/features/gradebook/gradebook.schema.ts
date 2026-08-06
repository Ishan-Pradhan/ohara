import { z } from 'zod';

export const gradebookEntrySchema = z.object({
  assessmentId: z.string(),
  type: z.enum(['assignment', 'quiz']),
  score: z.number().nullable(),
  maxScore: z.number(),
  status: z.enum(['graded', 'pending', 'ungraded', 'not_submitted', 'not_attempted']),
});

export const gradebookAssessmentSchema = z.object({
  id: z.string(),
  type: z.enum(['assignment', 'quiz']),
  title: z.string(),
  maxScore: z.number(),
});

export const gradebookRowSchema = z.object({
  studentId: z.string(),
  studentName: z.string(),
  entries: z.array(gradebookEntrySchema),
  totalScore: z.number(),
  totalMaxScore: z.number(),
  average: z.number().nullable(),
});

export const gradebookSchema = z.object({
  assessments: z.array(gradebookAssessmentSchema),
  rows: z.array(gradebookRowSchema),
});

export type GradebookEntry = z.infer<typeof gradebookEntrySchema>;
export type GradebookAssessment = z.infer<typeof gradebookAssessmentSchema>;
export type GradebookRow = z.infer<typeof gradebookRowSchema>;
export type Gradebook = z.infer<typeof gradebookSchema>;
