import { registry, z } from './registry.js';
import { envelope } from './user.response.js';

const unauthenticated = { description: 'Not authenticated' };

// page/limit stay raw strings (not z.coerce.number()) to match
// getAllUsersSchema's convention — getPaginationParams (pagination.utils.ts)
// does its own Number() coercion from PaginationQuery's string shape.
export const listNotificationsSchema = {
  query: z.object({
    page: z.string().optional(),
    limit: z.string().optional(),
  }),
};

export const markNotificationReadSchema = {
  params: z.object({ id: z.uuid() }),
};

export const deleteNotificationSchema = {
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

const paginationMetaSchema = z.object({
  totalItems: z.number(),
  itemCount: z.number(),
  itemsPerPage: z.number(),
  totalPages: z.number(),
  currentPage: z.number(),
});

registry.registerPath({
  method: 'get',
  path: '/notifications',
  tags: ['Notifications'],
  request: { query: listNotificationsSchema.query },
  responses: {
    200: {
      description:
        "The caller's notifications, newest first, paginated (page defaults to 1, limit to 10 if omitted — the bell dropdown always passes limit=20 and no page).",
      content: {
        'application/json': {
          schema: envelope(z.object({ items: z.array(notificationSchema), meta: paginationMetaSchema })),
        },
      },
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

registry.registerPath({
  method: 'delete',
  path: '/notifications/{id}',
  tags: ['Notifications'],
  request: { params: deleteNotificationSchema.params },
  responses: {
    200: { description: 'Notification deleted' },
    401: unauthenticated,
    403: { description: 'Notification does not belong to the caller' },
    404: { description: 'Notification not found' },
  },
});

registry.registerPath({
  method: 'delete',
  path: '/notifications',
  tags: ['Notifications'],
  responses: {
    200: { description: "Every one of the caller's notifications deleted" },
    401: unauthenticated,
  },
});
