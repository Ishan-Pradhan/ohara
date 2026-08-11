import { useMemo, useState } from 'react';
import { Calendar, dateFnsLocalizer, type View } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay, addMonths, subMonths } from 'date-fns';
import { enUS } from 'date-fns/locale';
import { Plus } from 'lucide-react';
import 'react-big-calendar/lib/css/react-big-calendar.css';

import { useCurrentUser } from '../features/auth/useAuth.js';
import { useMyEvents } from '../features/events/useEvents.js';
import type { Event as CalendarEvent } from '../features/events/events.schema.js';
import { AppShell } from '../components/layout/AppShell.js';
import { PageHeader } from '../components/layout/PageHeader.js';
import { Card } from '../components/ui/Card.js';
import { Button } from '../components/ui/Button.js';
import { Skeleton } from '../components/ui/Skeleton.js';
import { CreateEventDialog } from './CreateEventDialog.js';

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: () => startOfWeek(new Date(), { weekStartsOn: 0 }),
  getDay,
  locales: { 'en-US': enUS },
});

// A fixed, generous window (not tied to on-screen navigation) — simpler than
// wiring react-big-calendar's range-change callback, and wide enough that
// paging a month or two in either direction still has data loaded.
const RANGE_FROM = subMonths(new Date(), 2);
const RANGE_TO = addMonths(new Date(), 6);

const typeColor: Record<string, string> = {
  event: 'var(--color-primary)',
  holiday: 'var(--color-success)',
  exam: 'var(--color-danger)',
  birthday: 'var(--color-accent)',
};

export const CalendarPage = () => {
  const { data: user } = useCurrentUser();
  const { data: events, isLoading } = useMyEvents(RANGE_FROM, RANGE_TO);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [view, setView] = useState<View>('month');
  const [date, setDate] = useState(new Date());

  const canCreate = user?.role === 'admin' || user?.role === 'teacher';
  const isAdmin = user?.role === 'admin';

  const calendarEvents = useMemo(
    () =>
      (events ?? []).map((e) => ({
        ...e,
        start: new Date(e.startAt),
        end: e.endAt ? new Date(e.endAt) : new Date(e.startAt),
      })),
    [events],
  );

  const onSelectEvent = (event: CalendarEvent & { start: Date; end: Date }) => {
    if (event.type === 'birthday') return;
    if (!user || (user.id !== event.createdBy && user.role !== 'admin')) return;
    setEditingEvent(event);
    setDialogOpen(true);
  };

  return (
    <AppShell>
      <PageHeader
        title="Academic Calendar"
        description="School events, holidays, and exams — scoped to your program, semester, or the whole institution."
        actions={
          canCreate ? (
            <Button size="sm" onClick={() => { setEditingEvent(null); setDialogOpen(true); }}>
              <Plus className="size-4" aria-hidden />
              Add event
            </Button>
          ) : undefined
        }
      />

      <Card padding="sm">
        {isLoading ? (
          <Skeleton className="h-[600px] w-full" />
        ) : (
          <div className="ohara-calendar">
            <Calendar
              localizer={localizer}
              events={calendarEvents}
              startAccessor="start"
              endAccessor="end"
              allDayAccessor="allDay"
              titleAccessor="title"
              style={{ height: 700 }}
              view={view}
              onView={setView}
              date={date}
              onNavigate={setDate}
              views={['month', 'week', 'day', 'agenda']}
              popup
              onSelectEvent={onSelectEvent}
              eventPropGetter={(event) => ({
                style: {
                  backgroundColor: typeColor[event.type] ?? typeColor.event,
                  borderRadius: '6px',
                  border: 'none',
                },
              })}
            />
          </div>
        )}
      </Card>

      <CreateEventDialog open={dialogOpen} onOpenChange={setDialogOpen} editingEvent={editingEvent} />
    </AppShell>
  );
};
