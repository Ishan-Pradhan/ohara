import { z } from 'zod';

export const notificationSchema = z.object({
  id: z.string(),
  type: z.enum(['assignment_created', 'assignment_graded', 'quiz_published', 'quiz_graded']),
  title: z.string(),
  body: z.string().nullable(),
  link: z.string().nullable(),
  isRead: z.boolean(),
  createdAt: z.string(),
});

export type Notification = z.infer<typeof notificationSchema>;
