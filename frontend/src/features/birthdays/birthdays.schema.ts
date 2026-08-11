import { z } from 'zod';

export const birthdayPersonSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  dateOfBirth: z.string(),
  role: z.enum(['admin', 'teacher', 'student']),
  avatarUrl: z.string().nullable(),
  wishedToday: z.boolean(),
});

export type BirthdayPerson = z.infer<typeof birthdayPersonSchema>;

export const sendWishResponseSchema = z.object({
  sent: z.number(),
  failed: z.number(),
});

export type SendWishResponse = z.infer<typeof sendWishResponseSchema>;
