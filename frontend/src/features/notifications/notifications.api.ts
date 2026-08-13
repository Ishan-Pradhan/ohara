import { api } from '../../lib/axios.js';
import {
  notificationSchema,
  notificationsResultSchema,
  type Notification,
  type NotificationsResult,
} from './notifications.schema.js';
import { z } from 'zod';

export const fetchNotifications = async (params?: {
  page?: number;
  limit?: number;
}): Promise<NotificationsResult> => {
  const res = await api.get('/notifications', { params });
  return notificationsResultSchema.parse(res.data.data);
};

export const fetchUnreadCount = async (): Promise<number> => {
  const res = await api.get('/notifications/unread-count');
  return z.object({ count: z.number() }).parse(res.data.data).count;
};

export const markNotificationRead = async (id: string): Promise<Notification> => {
  const res = await api.patch(`/notifications/${id}/read`);
  return notificationSchema.parse(res.data.data);
};

export const markAllNotificationsRead = async (): Promise<void> => {
  await api.patch('/notifications/read-all');
};
