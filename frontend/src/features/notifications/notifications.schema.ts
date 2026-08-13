import { z } from 'zod';

import { paginationMetaSchema } from '../../schemas/pagination.schema.js';

export const notificationSchema = z.object({
  id: z.string(),
  type: z.enum(['assignment_created', 'assignment_graded', 'quiz_published', 'quiz_graded']),
  title: z.string(),
  body: z.string().nullable(),
  link: z.string().nullable(),
  isRead: z.boolean(),
  createdAt: z.string(),
});

export const notificationsResultSchema = z.object({
  items: z.array(notificationSchema),
  meta: paginationMetaSchema,
});

export type Notification = z.infer<typeof notificationSchema>;
export type NotificationsResult = z.infer<typeof notificationsResultSchema>;
