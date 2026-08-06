import { Link } from 'react-router-dom';
import { addDays } from 'date-fns';
import { CalendarDays } from 'lucide-react';

import { useMyEvents } from '../features/events/useEvents.js';
import { Card } from '../components/ui/Card.js';
import { Badge } from '../components/ui/Badge.js';
import { Skeleton } from '../components/ui/Skeleton.js';
import { EmptyState } from '../components/ui/EmptyState.js';

const typeBadge: Record<string, 'primary' | 'success' | 'danger' | 'accent'> = {
  event: 'primary',
  holiday: 'success',
  exam: 'danger',
  birthday: 'accent',
};

const from = new Date();
const to = addDays(new Date(), 30);

export const EventsWidget = () => {
  const { data: events, isLoading } = useMyEvents(from, to);
  const upcoming = (events ?? []).slice(0, 5);

  return (
    <Card padding="sm">
      <div className="mb-2 flex items-center justify-between px-1">
        <h2 className="text-sm font-semibold text-fg">Upcoming events</h2>
        <Link to="/calendar" className="text-xs font-medium text-primary hover:underline">
          View calendar
        </Link>
      </div>

      {isLoading ? (
        <Skeleton className="h-16 w-full" />
      ) : upcoming.length === 0 ? (
        <EmptyState icon={CalendarDays} title="No upcoming events" description="Events, holidays, and exams will show up here." />
      ) : (
        <div className="flex flex-col divide-y divide-border">
          {upcoming.map((event) => (
            <div key={event.id} className="flex items-center justify-between gap-3 px-1 py-2.5">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-fg">{event.title}</p>
                <p className="text-xs text-muted">{new Date(event.startAt).toLocaleString()}</p>
              </div>
              <Badge variant={typeBadge[event.type] ?? 'neutral'} className="shrink-0">
                {event.type}
              </Badge>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
};
