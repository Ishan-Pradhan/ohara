import type { Notification } from '../models/notifications.model.js';

export const serializeNotification = (notification: Notification) => ({
  id: notification.id,
  type: notification.type,
  title: notification.title,
  body: notification.body,
  link: notification.link,
  isRead: notification.isRead,
  createdAt: notification.createdAt.toISOString(),
});
