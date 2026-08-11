import { z } from 'zod';

export const eventTypeSchema = z.enum(['event', 'holiday', 'exam', 'birthday']);
export const eventAudienceSchema = z.enum(['global', 'institution_type', 'program', 'class']);
export const institutionTypeSchema = z.enum(['school', 'college', 'university']);

export const eventSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  type: eventTypeSchema,
  startAt: z.string(),
  endAt: z.string().nullable(),
  allDay: z.boolean(),
  audience: eventAudienceSchema,
  institutionType: institutionTypeSchema.nullable(),
  programId: z.string().nullable(),
  classId: z.string().nullable(),
  createdBy: z.string(),
});

export type EventType = z.infer<typeof eventTypeSchema>;
export type EventAudience = z.infer<typeof eventAudienceSchema>;
export type InstitutionType = z.infer<typeof institutionTypeSchema>;
export type Event = z.infer<typeof eventSchema>;

export type CreateEventInput =
  | { title: string; description?: string | null; type: EventType; startAt: string; endAt?: string | null; allDay: boolean; audience: 'global' }
  | { title: string; description?: string | null; type: EventType; startAt: string; endAt?: string | null; allDay: boolean; audience: 'institution_type'; institutionType: InstitutionType }
  | { title: string; description?: string | null; type: EventType; startAt: string; endAt?: string | null; allDay: boolean; audience: 'program'; programId: string }
  | { title: string; description?: string | null; type: EventType; startAt: string; endAt?: string | null; allDay: boolean; audience: 'class'; classId: string };

export type UpdateEventInput = CreateEventInput;
