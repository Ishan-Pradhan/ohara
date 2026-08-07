import { z } from 'zod';

export const conceptSnapshotSchema = z.object({
  topic: z.string(),
  masteryState: z.enum(['strong', 'developing', 'needs_attention', 'insufficient_data']),
  evidenceType: z.enum(['indirect', 'none']),
});

export const courseConceptsSchema = z.object({
  courseId: z.string(),
  courseTitle: z.string(),
  concepts: z.array(conceptSnapshotSchema),
  quizEvidence: z.object({
    quizCount: z.number(),
    attemptedCount: z.number(),
    averageScorePercentage: z.number().nullable(),
  }),
  hasTopics: z.boolean(),
  hasQuizEvidence: z.boolean(),
});

export const conceptInventorySchema = z.object({
  totalConcepts: z.number(),
  conceptsWithEvidence: z.number(),
  courses: z.array(courseConceptsSchema),
});

export type ConceptSnapshot = z.infer<typeof conceptSnapshotSchema>;
export type CourseConcepts = z.infer<typeof courseConceptsSchema>;
export type ConceptInventory = z.infer<typeof conceptInventorySchema>;
