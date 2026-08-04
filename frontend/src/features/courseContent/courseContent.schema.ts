import { z } from 'zod';

export const lessonSchema = z.object({
  id: z.string(),
  moduleId: z.string(),
  title: z.string(),
  content: z.string(),
  keyTopics: z.array(z.string()),
  orderIndex: z.number(),
  createdAt: z.string(),
});

export const moduleSchema = z.object({
  id: z.string(),
  courseId: z.string(),
  title: z.string(),
  orderIndex: z.number(),
  createdAt: z.string(),
  lessons: z.array(lessonSchema),
});

export const createModuleSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  orderIndex: z.number().int('Must be a whole number'),
});

export const createLessonSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  content: z.string().min(1, 'Content is required'),
  keyTopics: z.array(z.string()).optional(),
  orderIndex: z.number().int('Must be a whole number'),
});

export type Lesson = z.infer<typeof lessonSchema>;
export type Module = z.infer<typeof moduleSchema>;
export type CreateModuleInput = z.infer<typeof createModuleSchema>;
export type CreateLessonInput = z.infer<typeof createLessonSchema>;
