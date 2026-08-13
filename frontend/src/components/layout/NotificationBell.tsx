import * as RadixDropdown from '@radix-ui/react-dropdown-menu';
import { Bell, CheckCheck } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

import {
  useNotifications,
  useUnreadNotificationCount,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
} from '../../features/notifications/useNotifications.js';
import type { Notification } from '../../features/notifications/notifications.schema.js';
import { cn } from '../../lib/cn.js';

const timeAgo = (iso: string): string => {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
};

export const NotificationBell = () => {
  const navigate = useNavigate();
  const { data: unreadCount = 0 } = useUnreadNotificationCount(true);
  const { data: notifications, isLoading } = useNotifications(true);
  const { mutate: markRead } = useMarkNotificationRead();
  const { mutate: markAllRead } = useMarkAllNotificationsRead();

  const handleSelect = (notification: Notification) => {
    if (!notification.isRead) markRead(notification.id);
    if (notification.link) navigate(notification.link);
  };

  return (
    <RadixDropdown.Root>
      <RadixDropdown.Trigger
        className="relative flex size-9 items-center justify-center rounded-control text-muted transition-colors hover:bg-surface-hover hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        aria-label="Notifications"
      >
        <Bell className="size-4.5" aria-hidden />
        {unreadCount > 0 ? (
          <span className="absolute right-1 top-1 flex size-4 items-center justify-center rounded-full bg-danger text-[10px] font-semibold text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        ) : null}
      </RadixDropdown.Trigger>
      <RadixDropdown.Portal>
        <RadixDropdown.Content
          align="end"
          sideOffset={8}
          className="z-50 w-80 max-w-[calc(100vw-2rem)] rounded-card border border-border bg-surface p-1.5 shadow-lg shadow-black/5"
        >
          <div className="flex items-center justify-between px-2.5 py-1.5">
            <span className="text-xs font-semibold uppercase tracking-wide text-subtle">
              Notifications
            </span>
            {unreadCount > 0 ? (
              <button
                type="button"
                onClick={() => markAllRead()}
                className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
              >
                <CheckCheck className="size-3.5" aria-hidden />
                Mark all read
              </button>
            ) : null}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {isLoading ? (
              <p className="px-2.5 py-6 text-center text-sm text-muted">Loading…</p>
            ) : !notifications || notifications.length === 0 ? (
              <p className="px-2.5 py-6 text-center text-sm text-muted">
                No notifications yet.
              </p>
            ) : (
              notifications.map((notification) => (
                <RadixDropdown.Item
                  key={notification.id}
                  onSelect={() => handleSelect(notification)}
                  className={cn(
                    'flex cursor-pointer flex-col gap-0.5 rounded-control px-2.5 py-2 text-sm outline-none transition-colors data-[highlighted]:bg-surface-hover',
                    !notification.isRead && 'bg-primary-soft/40',
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className={cn('font-medium text-fg', !notification.isRead && 'font-semibold')}>
                      {notification.title}
                    </span>
                    {!notification.isRead ? (
                      <span className="mt-1 size-1.5 shrink-0 rounded-full bg-primary" aria-hidden />
                    ) : null}
                  </div>
                  {notification.body ? (
                    <span className="text-xs text-muted">{notification.body}</span>
                  ) : null}
                  <span className="text-xs text-subtle">{timeAgo(notification.createdAt)}</span>
                </RadixDropdown.Item>
              ))
            )}
          </div>

          <RadixDropdown.Item asChild>
            <Link
              to="/notifications"
              className="mt-1 flex items-center justify-center rounded-control px-2.5 py-2 text-sm font-medium text-primary outline-none transition-colors data-[highlighted]:bg-surface-hover"
            >
              View all
            </Link>
          </RadixDropdown.Item>
        </RadixDropdown.Content>
      </RadixDropdown.Portal>
    </RadixDropdown.Root>
  );
};
