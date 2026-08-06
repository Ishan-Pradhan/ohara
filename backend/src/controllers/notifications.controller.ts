import type { Response } from 'express';

import type { AuthRequest } from '../types/auth.types.js';
import { notificationRepository } from '../repositories/notifications.repository.js';
import { serializeNotification } from '../serializers/notifications.serializer.js';
import { asyncHandler } from '../utils/AsyncHandler.js';
import { ok } from '../utils/ApiResponse.js';
import { ApiError } from '../utils/ApiError.js';

export const listNotifications = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      throw new ApiError(401, 'Unauthorized');
    }
    const { limit } = (req.validated?.query ?? {}) as { limit?: number };
    const notifications = await notificationRepository.findByUser(userId, limit);
    return ok(res, notifications.map(serializeNotification), 'Notifications retrieved');
  },
);

export const getUnreadCount = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      throw new ApiError(401, 'Unauthorized');
    }
    const count = await notificationRepository.countUnread(userId);
    return ok(res, { count }, 'Unread count retrieved');
  },
);

export const markNotificationRead = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      throw new ApiError(401, 'Unauthorized');
    }
    const { id } = req.validated?.params as { id: string };

    const existing = await notificationRepository.findById(id);
    if (!existing) {
      throw new ApiError(404, 'Notification not found');
    }
    if (existing.userId !== userId) {
      throw new ApiError(403, 'Notification does not belong to the caller');
    }

    const notification = await notificationRepository.markRead(id);
    if (!notification) {
      throw new ApiError(404, 'Notification not found');
    }
    return ok(res, serializeNotification(notification), 'Notification marked as read');
  },
);

export const markAllNotificationsRead = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      throw new ApiError(401, 'Unauthorized');
    }
    await notificationRepository.markAllRead(userId);
    return ok(res, null, 'All notifications marked as read');
  },
);
