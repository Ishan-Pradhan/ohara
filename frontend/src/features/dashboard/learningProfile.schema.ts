import { z } from 'zod';

import { performanceSnapshotSchema } from './dashboard.schema.js';

export const learningProfileCourseInsightSchema = z.object({
  courseId: z.string(),
  courseTitle: z.string(),
  status: z.enum(['strong', 'developing', 'needs_attention', 'insufficient_data']),
  note: z.string(),
});

export const learningProfileInterpretationSchema = z.object({
  summary: z.string(),
  strengths: z.array(z.string()),
  attentionAreas: z.array(z.string()),
  nextActions: z.array(z.string()),
  courseInsights: z.array(learningProfileCourseInsightSchema),
});

export const learningProfileSchema = z.object({
  snapshot: performanceSnapshotSchema,
  profile: learningProfileInterpretationSchema,
});

export type LearningProfileCourseInsight = z.infer<typeof learningProfileCourseInsightSchema>;
export type LearningProfileInterpretation = z.infer<typeof learningProfileInterpretationSchema>;
export type LearningProfile = z.infer<typeof learningProfileSchema>;
