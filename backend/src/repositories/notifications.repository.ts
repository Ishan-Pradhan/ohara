import { Notification } from '../models/notifications.model.js';
import type { NotificationCreationAttributes } from '../types/notifications.types.js';

export const notificationRepository = {
  create: async (data: NotificationCreationAttributes): Promise<Notification> => {
    return await Notification.create(data);
  },

  bulkCreate: async (data: NotificationCreationAttributes[]): Promise<Notification[]> => {
    if (data.length === 0) return [];
    return await Notification.bulkCreate(data);
  },

  findByUser: async (userId: string, limit = 20): Promise<Notification[]> => {
    return await Notification.findAll({
      where: { userId },
      order: [['createdAt', 'DESC']],
      limit,
    });
  },

  countUnread: async (userId: string): Promise<number> => {
    return await Notification.count({ where: { userId, isRead: false } });
  },

  findById: async (id: string): Promise<Notification | null> => {
    return await Notification.findByPk(id);
  },

  markRead: async (id: string): Promise<Notification | null> => {
    const notification = await Notification.findByPk(id);
    if (!notification) return null;
    return await notification.update({ isRead: true });
  },

  markAllRead: async (userId: string): Promise<void> => {
    await Notification.update({ isRead: true }, { where: { userId, isRead: false } });
  },
};
