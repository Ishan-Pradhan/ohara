import { useSearchParams, useNavigate } from 'react-router-dom';
import { Bell, CheckCheck } from 'lucide-react';

import {
  usePagedNotifications,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
  useUnreadNotificationCount,
} from '../features/notifications/useNotifications.js';
import type { Notification } from '../features/notifications/notifications.schema.js';
import { AppShell } from '../components/layout/AppShell.js';
import { PageHeader } from '../components/layout/PageHeader.js';
import { Button } from '../components/ui/Button.js';
import { Card } from '../components/ui/Card.js';
import { Skeleton } from '../components/ui/Skeleton.js';
import { EmptyState } from '../components/ui/EmptyState.js';
import { Pagination } from '../components/ui/Pagination.js';
import { cn } from '../lib/cn.js';

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

export const NotificationsPage = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const page = Number(searchParams.get('page')) || 1;

  const setPage = (next: number) => {
    setSearchParams((prev) => {
      const params = new URLSearchParams(prev);
      if (next > 1) params.set('page', String(next));
      else params.delete('page');
      return params;
    });
  };

  const { data, isLoading } = usePagedNotifications(page);
  const { data: unreadCount = 0 } = useUnreadNotificationCount(true);
  const { mutate: markRead } = useMarkNotificationRead();
  const { mutate: markAllRead } = useMarkAllNotificationsRead();

  const notifications = data?.items ?? [];

  const handleSelect = (notification: Notification) => {
    if (!notification.isRead) markRead(notification.id);
    if (notification.link) navigate(notification.link);
  };

  return (
    <AppShell>
      <PageHeader
        title="Notifications"
        description="Everything sent to you, newest first."
        actions={
          unreadCount > 0 ? (
            <Button variant="secondary" onClick={() => markAllRead()}>
              <CheckCheck className="size-4" aria-hidden />
              Mark all read
            </Button>
          ) : undefined
        }
      />

      {isLoading ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : notifications.length === 0 ? (
        <EmptyState icon={Bell} title="No notifications yet" />
      ) : (
        <div className="flex flex-col gap-2">
          {notifications.map((notification) => (
            <Card
              key={notification.id}
              padding="sm"
              role="button"
              tabIndex={0}
              className={cn(
                'cursor-pointer transition-colors hover:border-primary/30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
                !notification.isRead && 'border-primary/25 bg-primary-soft/40',
              )}
              onClick={() => handleSelect(notification)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleSelect(notification);
                }
              }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className={cn('text-sm text-fg', !notification.isRead && 'font-semibold')}>
                    {notification.title}
                  </p>
                  {notification.body ? (
                    <p className="mt-0.5 text-sm text-muted">{notification.body}</p>
                  ) : null}
                  <p className="mt-1 text-xs text-subtle">{timeAgo(notification.createdAt)}</p>
                </div>
                {!notification.isRead ? (
                  <span className="mt-1 size-1.5 shrink-0 rounded-full bg-primary" aria-hidden />
                ) : null}
              </div>
            </Card>
          ))}
        </div>
      )}

      {data ? (
        <div className="mt-4">
          <Pagination meta={data.meta} onPageChange={setPage} />
        </div>
      ) : null}
    </AppShell>
  );
};
