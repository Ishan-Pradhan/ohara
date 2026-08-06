import { registry, z } from './registry.js';
import { envelope } from './user.response.js';

const unauthenticated = { description: 'Not authenticated' };

export const listNotificationsSchema = {
  query: z.object({ limit: z.coerce.number().int().min(1).max(100).optional() }),
};

export const markNotificationReadSchema = {
  params: z.object({ id: z.uuid() }),
};

const notificationSchema = registry.register(
  'Notification',
  z.object({
    id: z.uuid(),
    type: z.enum(['assignment_created', 'assignment_graded', 'quiz_published', 'quiz_graded']),
    title: z.string(),
    body: z.string().nullable(),
    link: z.string().nullable(),
    isRead: z.boolean(),
    createdAt: z.iso.datetime(),
  }),
);

registry.registerPath({
  method: 'get',
  path: '/notifications',
  tags: ['Notifications'],
  request: { query: listNotificationsSchema.query },
  responses: {
    200: {
      description: "The caller's most recent notifications, newest first",
      content: { 'application/json': { schema: envelope(z.array(notificationSchema)) } },
    },
    401: unauthenticated,
  },
});

registry.registerPath({
  method: 'get',
  path: '/notifications/unread-count',
  tags: ['Notifications'],
  responses: {
    200: {
      description: "Count of the caller's unread notifications",
      content: { 'application/json': { schema: envelope(z.object({ count: z.number() })) } },
    },
    401: unauthenticated,
  },
});

registry.registerPath({
  method: 'patch',
  path: '/notifications/{id}/read',
  tags: ['Notifications'],
  request: { params: markNotificationReadSchema.params },
  responses: {
    200: {
      description: 'Notification marked as read',
      content: { 'application/json': { schema: envelope(notificationSchema) } },
    },
    401: unauthenticated,
    403: { description: 'Notification does not belong to the caller' },
    404: { description: 'Notification not found' },
  },
});

registry.registerPath({
  method: 'patch',
  path: '/notifications/read-all',
  tags: ['Notifications'],
  responses: {
    200: { description: "Every one of the caller's unread notifications marked as read" },
    401: unauthenticated,
  },
});
