import { z } from 'zod';

export const lessonPlanOutlineSchema = z.object({
  section: z.string(),
  durationMinutes: z.number(),
  description: z.string(),
});

export const lessonPlanActivitySchema = z.object({
  name: z.string(),
  type: z.enum(['discussion', 'practice', 'group', 'individual', 'demonstration']),
  description: z.string(),
  durationMinutes: z.number(),
});

export const lessonPlanSchema = z.object({
  title: z.string(),
  objectives: z.array(z.string()),
  outline: z.array(lessonPlanOutlineSchema),
  activities: z.array(lessonPlanActivitySchema),
  assessmentIdeas: z.array(z.string()),
  materials: z.array(z.string()).optional(),
});

export type LessonPlan = z.infer<typeof lessonPlanSchema>;
