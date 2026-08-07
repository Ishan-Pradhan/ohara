import { z } from 'zod';

export const studyPlanTaskSchema = z.object({
  type: z.enum(['review', 'practice', 'assignment', 'quiz', 'concept']),
  title: z.string(),
  courseId: z.string().optional(),
  courseTitle: z.string().optional(),
  description: z.string(),
  estimatedMinutes: z.number(),
  priority: z.enum(['high', 'medium', 'low']),
  done: z.boolean().optional(),
});

export const studyPlanDaySchema = z.object({
  day: z.enum(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']),
  date: z.string(),
  tasks: z.array(studyPlanTaskSchema),
});

export const studyPlanContentSchema = z.object({
  summary: z.string(),
  weekStart: z.string(),
  days: z.array(studyPlanDaySchema),
  evidence: z.object({
    upcomingAssessments: z.number(),
    weakConcepts: z.number(),
    missingSubmissions: z.number(),
    averageGrade: z.number().nullable(),
  }),
});

export const studyPlanSchema = z.object({
  id: z.string(),
  studentId: z.string(),
  weekStart: z.string(),
  content: studyPlanContentSchema,
  status: z.enum(['active', 'superseded']),
  isStale: z.boolean(),
  staleReason: z.string().nullable(),
  generatedAt: z.string(),
  createdAt: z.string(),
});

export type StudyPlanTask = z.infer<typeof studyPlanTaskSchema>;
export type StudyPlanDay = z.infer<typeof studyPlanDaySchema>;
export type StudyPlanContent = z.infer<typeof studyPlanContentSchema>;
export type StudyPlan = z.infer<typeof studyPlanSchema>;
