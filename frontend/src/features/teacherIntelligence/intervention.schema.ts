import { z } from 'zod';

export const interventionActionSchema = z.object({
  description: z.string(),
  timeline: z.string(),
  resources: z.string().optional(),
});

export const interventionSchema = z.object({
  id: z.string(),
  studentId: z.string(),
  courseId: z.string(),
  teacherId: z.string(),
  type: z.enum(['ai_generated', 'manual', 'meeting', 'tutoring', 'other']),
  title: z.string(),
  notes: z.string(),
  actions: z.array(interventionActionSchema),
  status: z.enum(['active', 'resolved', 'dismissed']),
  resolvedAt: z.string().nullable(),
  createdAt: z.string(),
  student: z.object({ id: z.string(), name: z.string(), email: z.string() }).nullable(),
  teacher: z.object({ id: z.string(), name: z.string(), email: z.string() }).nullable(),
});

export type Intervention = z.infer<typeof interventionSchema>;
export type InterventionAction = z.infer<typeof interventionActionSchema>;

export const createInterventionInputSchema = z.object({
  studentId: z.string(),
  type: z.enum(['manual', 'meeting', 'tutoring', 'other']),
  title: z.string().min(1).max(200),
  notes: z.string().min(1).max(2000),
  actions: z.array(interventionActionSchema).optional().default([]),
});

export type CreateInterventionInput = z.infer<typeof createInterventionInputSchema>;
