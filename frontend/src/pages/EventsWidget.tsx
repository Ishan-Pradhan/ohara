import { Link } from 'react-router-dom';
import { addDays, format } from 'date-fns';
import { CalendarDays } from 'lucide-react';

import { useMyEvents } from '../features/events/useEvents.js';
import { Card } from '../components/ui/Card.js';
import { Skeleton } from '../components/ui/Skeleton.js';
import { EmptyState } from '../components/ui/EmptyState.js';

// Same semantic colours as the calendar's own legend and event pills
// (CalendarPage.tsx) — an exam here and an exam on the calendar read as the
// same colour everywhere in the app.
const typeAccent: Record<string, { fg: string; soft: string }> = {
  event: { fg: 'var(--color-primary)', soft: 'var(--color-primary-soft)' },
  holiday: { fg: 'var(--color-success)', soft: 'var(--color-success-soft)' },
  exam: { fg: 'var(--color-danger)', soft: 'var(--color-danger-soft)' },
  birthday: { fg: 'var(--color-accent-fg)', soft: 'var(--color-accent-soft)' },
};

const from = new Date();
const to = addDays(new Date(), 30);

export const EventsWidget = () => {
  const { data: events, isLoading } = useMyEvents(from, to);
  const upcoming = (events ?? []).slice(0, 5);

  return (
    <Card padding="sm">
      <div className="mb-3 flex items-center justify-between px-1">
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
        <div className="flex flex-col gap-1.5">
          {upcoming.map((event) => {
            const accent = typeAccent[event.type] ?? typeAccent.event;
            const startAt = new Date(event.startAt);
            return (
              <div
                key={event.id}
                className="flex items-center gap-3 rounded-control px-1 py-2 transition-colors hover:bg-surface-hover"
              >
                <div
                  className="flex w-11 shrink-0 flex-col items-center rounded-control py-1"
                  style={{ backgroundColor: accent.soft }}
                >
                  <span className="text-[0.65rem] font-semibold uppercase tracking-wide" style={{ color: accent.fg }}>
                    {format(startAt, 'MMM')}
                  </span>
                  <span className="font-mono text-base font-semibold leading-none" style={{ color: accent.fg }}>
                    {format(startAt, 'd')}
                  </span>
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-fg">{event.title}</p>
                  <p className="text-xs text-muted">
                    {event.allDay ? format(startAt, 'EEEE') : format(startAt, 'EEEE · h:mm a')}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
};
