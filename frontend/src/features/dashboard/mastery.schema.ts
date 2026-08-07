import { z } from 'zod';

export const weakQuestionSchema = z.object({
  questionId: z.string(),
  prompt: z.string(),
  attempts: z.number(),
  correct: z.number(),
  correctRate: z.number(),
  masteryState: z.enum(['developing', 'needs_attention']),
});

export const weakCriterionSchema = z.object({
  criterion: z.string(),
  scoreRate: z.number(),
  masteryState: z.enum(['developing', 'needs_attention']),
});

export const courseMasteryReportSchema = z.object({
  courseId: z.string(),
  courseTitle: z.string(),
  overallMastery: z.enum(['strong', 'developing', 'needs_attention', 'insufficient_data']),
  mcqMasteryPercentage: z.number().nullable(),
  weakQuestions: z.array(weakQuestionSchema),
  weakCriteria: z.array(weakCriterionSchema),
  evidence: z.object({
    mcqQuestionsAttempted: z.number(),
    totalMcqQuestions: z.number(),
    criteriaEvaluated: z.number(),
  }),
});

export const masteryReportSchema = z.object({
  coursesWithEvidence: z.number(),
  coursesNeedingAttention: z.number(),
  courses: z.array(courseMasteryReportSchema),
});

export type WeakQuestion = z.infer<typeof weakQuestionSchema>;
export type WeakCriterion = z.infer<typeof weakCriterionSchema>;
export type CourseMasteryReport = z.infer<typeof courseMasteryReportSchema>;
export type MasteryReport = z.infer<typeof masteryReportSchema>;
