import type { Response } from 'express';

import type { AuthRequest } from '../types/auth.types.js';
import { notificationRepository } from '../repositories/notifications.repository.js';
import { serializeNotification } from '../serializers/notifications.serializer.js';
import { getPaginationParams, buildPaginationMeta } from '../utils/pagination.utils.js';
import type { PaginationQuery } from '../types/pagination.types.js';
import { asyncHandler } from '../utils/AsyncHandler.js';
import { ok } from '../utils/ApiResponse.js';
import { ApiError } from '../utils/ApiError.js';

export const listNotifications = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      throw new ApiError(401, 'Unauthorized');
    }
    const query = (req.validated?.query ?? {}) as PaginationQuery;
    const { page, limit, offset } = getPaginationParams(query);

    const { rows: notifications, count: totalItems } = await notificationRepository.findAndCountAll(
      userId,
      { limit, offset },
    );

    return ok(
      res,
      {
        items: notifications.map(serializeNotification),
        meta: buildPaginationMeta({ totalItems, page, limit, itemCount: notifications.length }),
      },
      'Notifications retrieved',
    );
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

export const deleteNotification = asyncHandler(
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

    await notificationRepository.delete(id);
    return ok(res, null, 'Notification deleted');
  },
);

export const deleteAllNotifications = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      throw new ApiError(401, 'Unauthorized');
    }
    await notificationRepository.deleteAll(userId);
    return ok(res, null, 'All notifications deleted');
  },
);
