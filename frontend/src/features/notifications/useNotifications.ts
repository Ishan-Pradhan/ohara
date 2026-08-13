import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  fetchNotifications,
  fetchUnreadCount,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
  deleteAllNotifications,
} from './notifications.api.js';

// Bell dropdown (recent-20 preview) and the full paginated page share the
// same ['notifications', ...] prefix, so a single invalidateQueries call
// below refreshes both regardless of which params they were fetched with.
const NOTIFICATIONS_PREFIX = ['notifications'] as const;
export const notificationsKey = (params: { page?: number; limit?: number }) =>
  [...NOTIFICATIONS_PREFIX, params] as const;
export const unreadCountKey = ['notifications', 'unread-count'] as const;

const POLL_INTERVAL_MS = 60_000;
const BELL_PREVIEW_LIMIT = 20;
const NOTIFICATIONS_PAGE_LIMIT = 20;

/** Bell dropdown — most-recent preview, not a pager. */
export const useNotifications = (enabled: boolean) =>
  useQuery({
    queryKey: notificationsKey({ limit: BELL_PREVIEW_LIMIT }),
    queryFn: () => fetchNotifications({ limit: BELL_PREVIEW_LIMIT }),
    select: (data) => data.items,
    enabled,
  });

/** The full "All notifications" page — real pagination. */
export const usePagedNotifications = (page: number) =>
  useQuery({
    queryKey: notificationsKey({ page, limit: NOTIFICATIONS_PAGE_LIMIT }),
    queryFn: () => fetchNotifications({ page, limit: NOTIFICATIONS_PAGE_LIMIT }),
  });

export const useUnreadNotificationCount = (enabled: boolean) =>
  useQuery({
    queryKey: unreadCountKey,
    queryFn: fetchUnreadCount,
    enabled,
    refetchInterval: POLL_INTERVAL_MS,
  });

export const useMarkNotificationRead = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: markNotificationRead,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_PREFIX });
      void queryClient.invalidateQueries({ queryKey: unreadCountKey });
    },
  });
};

export const useMarkAllNotificationsRead = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: markAllNotificationsRead,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_PREFIX });
      void queryClient.invalidateQueries({ queryKey: unreadCountKey });
    },
  });
};

export const useDeleteNotification = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteNotification,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_PREFIX });
      void queryClient.invalidateQueries({ queryKey: unreadCountKey });
    },
  });
};

export const useDeleteAllNotifications = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteAllNotifications,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_PREFIX });
      void queryClient.invalidateQueries({ queryKey: unreadCountKey });
    },
  });
};
