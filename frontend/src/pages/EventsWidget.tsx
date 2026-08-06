import { useState } from 'react';
import { CalendarDays, Plus, Trash2 } from 'lucide-react';

import { useCurrentUser } from '../features/auth/useAuth.js';
import { useMyEvents, useCreateEvent, useDeleteEvent } from '../features/events/useEvents.js';
import { useMyCourses } from '../features/teacher/useTeacher.js';
import { toast } from '../lib/toast.js';
import { Card } from '../components/ui/Card.js';
import { Button } from '../components/ui/Button.js';
import { Skeleton } from '../components/ui/Skeleton.js';
import { EmptyState } from '../components/ui/EmptyState.js';
import { Dialog } from '../components/ui/Dialog.js';
import { Field } from '../components/ui/Field.js';
import { Input } from '../components/ui/Input.js';
import { Textarea } from '../components/ui/Textarea.js';
import { Select } from '../components/ui/Select.js';

const audienceLabel: Record<string, string> = {
  global: 'Everyone',
  program: 'Program',
  class: 'Class',
  section: 'Section',
  course: 'Course',
};

const CreateEventDialog = ({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) => {
  const { data: user } = useCurrentUser();
  const { data: myCourses } = useMyCourses();
  const createEvent = useCreateEvent();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startAt, setStartAt] = useState('');
  const [courseId, setCourseId] = useState('');

  const isTeacher = user?.role === 'teacher';

  const reset = () => {
    setTitle('');
    setDescription('');
    setStartAt('');
    setCourseId('');
  };

  const onSubmit = async () => {
    if (!title || !startAt) return;
    if (isTeacher && !courseId) {
      toast.error('Pick a course for this event');
      return;
    }
    try {
      await createEvent.mutateAsync(
        isTeacher
          ? { title, description: description || null, startAt: new Date(startAt).toISOString(), audience: 'course', courseId }
          : { title, description: description || null, startAt: new Date(startAt).toISOString(), audience: 'global' },
      );
      toast.success('Event created');
      reset();
      onOpenChange(false);
    } catch {
      toast.error('Could not create the event');
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="New event"
      description={isTeacher ? 'Visible to everyone enrolled in the course you pick.' : 'Visible to everyone at the institution.'}
    >
      <div className="flex flex-col gap-4">
        <Field label="Title" htmlFor="event-title">
          <Input id="event-title" value={title} onChange={(e) => setTitle(e.target.value)} />
        </Field>
        <Field label="Description" htmlFor="event-description">
          <Textarea id="event-description" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        <Field label="Date & time" htmlFor="event-startAt">
          <Input id="event-startAt" type="datetime-local" value={startAt} onChange={(e) => setStartAt(e.target.value)} />
        </Field>
        {isTeacher ? (
          <Field label="Course" htmlFor="event-course">
            <Select
              id="event-course"
              value={courseId}
              onValueChange={setCourseId}
              placeholder="Select a course"
              options={(myCourses ?? []).map((c) => ({ value: c.id, label: c.title }))}
            />
          </Field>
        ) : null}
        <div className="mt-2 flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" loading={createEvent.isPending} onClick={onSubmit}>
            Create event
          </Button>
        </div>
      </div>
    </Dialog>
  );
};

export const EventsWidget = () => {
  const { data: user } = useCurrentUser();
  const { data: events, isLoading } = useMyEvents();
  const deleteEventMutation = useDeleteEvent();
  const [dialogOpen, setDialogOpen] = useState(false);

  const canCreate = user?.role === 'admin' || user?.role === 'teacher';

  return (
    <Card padding="sm">
      <div className="mb-2 flex items-center justify-between px-1">
        <h2 className="text-sm font-semibold text-fg">Upcoming events</h2>
        {canCreate ? (
          <Button size="sm" variant="secondary" onClick={() => setDialogOpen(true)}>
            <Plus className="size-4" aria-hidden />
            Add event
          </Button>
        ) : null}
      </div>

      {isLoading ? (
        <Skeleton className="h-16 w-full" />
      ) : !events || events.length === 0 ? (
        <EmptyState icon={CalendarDays} title="No upcoming events" description="Events your admin or teachers add will show up here." />
      ) : (
        <div className="flex flex-col divide-y divide-border">
          {events.map((event) => (
            <div key={event.id} className="flex items-center justify-between gap-3 px-1 py-2.5">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-fg">{event.title}</p>
                <p className="text-xs text-muted">
                  {new Date(event.startAt).toLocaleString()} · {audienceLabel[event.audience]}
                </p>
              </div>
              {user && (user.id === event.createdBy || user.role === 'admin') ? (
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label="Delete event"
                  onClick={() => deleteEventMutation.mutate(event.id)}
                >
                  <Trash2 className="size-4 text-danger" aria-hidden />
                </Button>
              ) : null}
            </div>
          ))}
        </div>
      )}

      <CreateEventDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </Card>
  );
};
