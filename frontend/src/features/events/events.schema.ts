import { z } from 'zod';

export const eventAudienceSchema = z.enum(['global', 'program', 'class', 'section', 'course']);

export const eventSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  startAt: z.string(),
  audience: eventAudienceSchema,
  programId: z.string().nullable(),
  classId: z.string().nullable(),
  sectionId: z.string().nullable(),
  courseId: z.string().nullable(),
  createdBy: z.string(),
});

export type EventAudience = z.infer<typeof eventAudienceSchema>;
export type Event = z.infer<typeof eventSchema>;

export type CreateEventInput =
  | { title: string; description?: string | null; startAt: string; audience: 'global' }
  | { title: string; description?: string | null; startAt: string; audience: 'course'; courseId: string };
