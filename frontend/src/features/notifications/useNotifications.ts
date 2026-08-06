import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  fetchNotifications,
  fetchUnreadCount,
  markNotificationRead,
  markAllNotificationsRead,
} from './notifications.api.js';

export const notificationsKey = ['notifications'] as const;
export const unreadCountKey = ['notifications', 'unread-count'] as const;

const POLL_INTERVAL_MS = 60_000;

export const useNotifications = (enabled: boolean) =>
  useQuery({
    queryKey: notificationsKey,
    queryFn: fetchNotifications,
    enabled,
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
      void queryClient.invalidateQueries({ queryKey: notificationsKey });
      void queryClient.invalidateQueries({ queryKey: unreadCountKey });
    },
  });
};

export const useMarkAllNotificationsRead = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: markAllNotificationsRead,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: notificationsKey });
      void queryClient.invalidateQueries({ queryKey: unreadCountKey });
    },
  });
};
