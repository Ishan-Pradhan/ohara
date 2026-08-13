import { z } from 'zod';

/* Mirrors backend/src/types/courseStudyAids.types.ts and courseStudyAid.serializer.ts. */

export const flashcardSchema = z.object({
  front: z.string(),
  back: z.string(),
});
export type Flashcard = z.infer<typeof flashcardSchema>;

export const summaryContentSchema = z.object({
  summary: z.string(),
  keyPoints: z.array(z.string()),
});
export type SummaryContent = z.infer<typeof summaryContentSchema>;

export const flashcardsContentSchema = z.object({
  cards: z.array(flashcardSchema),
});
export type FlashcardsContent = z.infer<typeof flashcardsContentSchema>;

export const summaryAidSchema = z.object({
  id: z.string(),
  courseId: z.string(),
  lessonId: z.string().nullable(),
  type: z.literal('summary'),
  content: summaryContentSchema,
  createdAt: z.string(),
});
export type SummaryAid = z.infer<typeof summaryAidSchema>;

export const flashcardsAidSchema = z.object({
  id: z.string(),
  courseId: z.string(),
  lessonId: z.string().nullable(),
  type: z.literal('flashcards'),
  content: flashcardsContentSchema,
  createdAt: z.string(),
});
export type FlashcardsAid = z.infer<typeof flashcardsAidSchema>;

export const explanationSchema = z.object({
  explanation: z.string(),
});
