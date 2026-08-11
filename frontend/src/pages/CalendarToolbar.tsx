import { format } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { ToolbarProps, View } from 'react-big-calendar';

import { cn } from '../lib/cn.js';
import { Button } from '../components/ui/Button.js';
import type { Event as CalendarEvent } from '../features/events/events.schema.js';

const viewOptions: { value: View; label: string }[] = [
  { value: 'month', label: 'Month' },
  { value: 'week', label: 'Week' },
  { value: 'day', label: 'Day' },
  { value: 'agenda', label: 'Agenda' },
];

type ToolbarEvent = CalendarEvent & { start: Date; end: Date };

export const CalendarToolbar = ({ date, view, onNavigate, onView }: ToolbarProps<ToolbarEvent>) => {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-0.5 rounded-control border border-border bg-surface p-0.5">
          <button
            type="button"
            onClick={() => onNavigate('PREV')}
            aria-label="Previous"
            className="inline-flex size-8 items-center justify-center rounded-[0.4rem] text-muted transition-colors hover:bg-surface-hover hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <ChevronLeft className="size-4" aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => onNavigate('NEXT')}
            aria-label="Next"
            className="inline-flex size-8 items-center justify-center rounded-[0.4rem] text-muted transition-colors hover:bg-surface-hover hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <ChevronRight className="size-4" aria-hidden />
          </button>
        </div>
        <Button type="button" variant="secondary" size="sm" onClick={() => onNavigate('TODAY')}>
          Today
        </Button>
      </div>

      <h2 className="order-first w-full text-center sm:order-none sm:w-auto sm:text-left">
        <span className="font-display text-2xl italic text-fg">{format(date, 'MMMM')}</span>{' '}
        <span className="text-2xl font-light text-subtle">{format(date, 'yyyy')}</span>
      </h2>

      <div className="inline-flex gap-1 overflow-x-auto rounded-control bg-surface-hover p-1 scrollbar-none">
        {viewOptions.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onView(option.value)}
            aria-current={view === option.value}
            className={cn(
              'rounded-[0.4rem] px-3.5 py-1.5 text-sm font-medium text-muted transition-colors',
              'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
              view === option.value ? 'bg-surface text-fg shadow-sm' : 'hover:text-fg',
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
};
