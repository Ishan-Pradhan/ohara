import { useMemo, useState, type CSSProperties } from 'react';
import { Calendar, dateFnsLocalizer, type View } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay, addMonths, subMonths } from 'date-fns';
import { enUS } from 'date-fns/locale';
import { Plus } from 'lucide-react';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import '../styles/calendar.css';

import { useCurrentUser } from '../features/auth/useAuth.js';
import { useMyEvents } from '../features/events/useEvents.js';
import type { Event as CalendarEvent, EventType } from '../features/events/events.schema.js';
import { AppShell } from '../components/layout/AppShell.js';
import { PageHeader } from '../components/layout/PageHeader.js';
import { Card } from '../components/ui/Card.js';
import { Button } from '../components/ui/Button.js';
import { Skeleton } from '../components/ui/Skeleton.js';
import { CreateEventDialog } from './CreateEventDialog.js';
import { CalendarToolbar } from './CalendarToolbar.js';

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

// Soft-tint pairs (background + foreground), one per event type — the same
// semantic colours Badge.tsx already uses for these variants, so an "Exam"
// pill on the calendar reads as the same colour as an "Exam" badge anywhere
// else in the app.
const eventStyle: Record<EventType, { soft: string; fg: string; border: string; dot: string }> = {
  event: {
    soft: 'var(--color-primary-soft)',
    fg: 'var(--color-primary)',
    border: 'color-mix(in oklch, var(--color-primary) 30%, transparent)',
    dot: 'var(--color-primary)',
  },
  holiday: {
    soft: 'var(--color-success-soft)',
    fg: 'var(--color-success)',
    border: 'color-mix(in oklch, var(--color-success) 30%, transparent)',
    dot: 'var(--color-success)',
  },
  exam: {
    soft: 'var(--color-danger-soft)',
    fg: 'var(--color-danger)',
    border: 'color-mix(in oklch, var(--color-danger) 30%, transparent)',
    dot: 'var(--color-danger)',
  },
  birthday: {
    soft: 'var(--color-accent-soft)',
    fg: 'var(--color-accent-fg)',
    border: 'color-mix(in oklch, var(--color-accent) 30%, transparent)',
    dot: 'var(--color-accent)',
  },
};

const legendItems: { type: EventType; label: string }[] = [
  { type: 'event', label: 'Event' },
  { type: 'holiday', label: 'Holiday' },
  { type: 'exam', label: 'Exam' },
  { type: 'birthday', label: 'Birthday' },
];

export const CalendarPage = () => {
  const { data: user } = useCurrentUser();
  const { data: events, isLoading } = useMyEvents(RANGE_FROM, RANGE_TO);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [view, setView] = useState<View>('month');
  const [date, setDate] = useState(new Date());

  const canCreate = user?.role === 'admin' || user?.role === 'teacher';

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

      <div className="mb-4 flex flex-wrap items-center gap-x-5 gap-y-2">
        {legendItems.map((item) => (
          <div key={item.type} className="flex items-center gap-1.5 text-xs font-medium text-muted">
            <span
              className="size-2 rounded-full"
              style={{ backgroundColor: eventStyle[item.type].dot }}
              aria-hidden
            />
            {item.label}
          </div>
        ))}
      </div>

      <Card padding="sm">
        {isLoading ? (
          <Skeleton className="h-[700px] w-full" />
        ) : (
          <div className="ohara-calendar">
            <Calendar
              key={`${view}-${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`}
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
              components={{ toolbar: CalendarToolbar }}
              eventPropGetter={(event) => {
                const style = eventStyle[event.type as EventType] ?? eventStyle.event;
                return {
                  style: {
                    '--ohara-event-soft': style.soft,
                    '--ohara-event-fg': style.fg,
                    '--ohara-event-border': style.border,
                  } as CSSProperties,
                };
              }}
            />
          </div>
        )}
      </Card>

      <CreateEventDialog open={dialogOpen} onOpenChange={setDialogOpen} editingEvent={editingEvent} />
    </AppShell>
  );
};
