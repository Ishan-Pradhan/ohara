import { useState, useEffect } from 'react';

import { useCurrentUser } from '../features/auth/useAuth.js';
import { useMyCourses } from '../features/teacher/useTeacher.js';
import { usePrograms, useClasses } from '../features/institution/useInstitution.js';
import { useCreateEvent, useUpdateEvent, useDeleteEvent } from '../features/events/useEvents.js';
import type { Event as CalendarEvent, EventAudience, EventType, InstitutionType } from '../features/events/events.schema.js';
import { toast } from '../lib/toast.js';
import { Dialog } from '../components/ui/Dialog.js';
import { Button } from '../components/ui/Button.js';
import { Field } from '../components/ui/Field.js';
import { Input } from '../components/ui/Input.js';
import { Textarea } from '../components/ui/Textarea.js';
import { Select } from '../components/ui/Select.js';
import { Checkbox } from '../components/ui/Checkbox.js';

interface CreateEventDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingEvent?: CalendarEvent | null;
}

const typeOptions: { value: EventType; label: string }[] = [
  { value: 'event', label: 'Event' },
  { value: 'holiday', label: 'Holiday' },
  { value: 'exam', label: 'Exam' },
];

const institutionTypeOptions: { value: InstitutionType; label: string }[] = [
  { value: 'school', label: 'School' },
  { value: 'college', label: 'College' },
  { value: 'university', label: 'University' },
];

export const CreateEventDialog = ({ open, onOpenChange, editingEvent }: CreateEventDialogProps) => {
  const { data: user } = useCurrentUser();
  const isAdmin = user?.role === 'admin';

  const { data: myCourses } = useMyCourses(user?.role === 'teacher');
  const { data: programs } = usePrograms();
  const { data: classes } = useClasses();

  const createEvent = useCreateEvent();
  const updateEvent = useUpdateEvent();
  const deleteEvent = useDeleteEvent();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<EventType>('event');
  const [startAt, setStartAt] = useState('');
  const [endAt, setEndAt] = useState('');
  const [allDay, setAllDay] = useState(false);
  const [audience, setAudience] = useState<EventAudience>(isAdmin ? 'global' : 'class');
  const [institutionType, setInstitutionType] = useState<InstitutionType>('school');
  const [programId, setProgramId] = useState('');
  const [classId, setClassId] = useState('');

  const isEdit = Boolean(editingEvent);

  useEffect(() => {
    if (editingEvent && open) {
      setTitle(editingEvent.title);
      setDescription(editingEvent.description ?? '');
      setType(editingEvent.type === 'birthday' ? 'event' : editingEvent.type);
      setStartAt(editingEvent.startAt.slice(0, 16));
      setEndAt(editingEvent.endAt?.slice(0, 16) ?? '');
      setAllDay(editingEvent.allDay);
      setAudience(editingEvent.audience);
      setInstitutionType(editingEvent.institutionType ?? 'school');
      setProgramId(editingEvent.programId ?? '');
      setClassId(editingEvent.classId ?? '');
    } else if (!open) {
      setTitle('');
      setDescription('');
      setType('event');
      setStartAt('');
      setEndAt('');
      setAllDay(false);
      setAudience(isAdmin ? 'global' : 'class');
      setProgramId('');
      setClassId('');
    }
  }, [editingEvent, open, isAdmin]);

  // A teacher's own classes, deduped, derived from the courses they teach.
  const myClasses = Array.from(
    new Map(
      (myCourses ?? [])
        .filter((c) => c.classId)
        .map((c) => [c.classId as string, { id: c.classId as string, name: c.className ?? 'Class' }]),
    ).values(),
  );

  const onSubmit = async () => {
    if (!title || !startAt) {
      toast.error('Title and start date are required');
      return;
    }
    if (audience === 'program' && !programId) {
      toast.error('Pick a program');
      return;
    }
    if (audience === 'class' && !classId) {
      toast.error('Pick a class');
      return;
    }

    const common = {
      title,
      description: description || null,
      type,
      startAt: new Date(startAt).toISOString(),
      endAt: endAt ? new Date(endAt).toISOString() : null,
      allDay,
    };

    try {
      let input;
      if (audience === 'global') {
        input = { ...common, audience: 'global' as const };
      } else if (audience === 'institution_type') {
        input = { ...common, audience: 'institution_type' as const, institutionType };
      } else if (audience === 'program') {
        input = { ...common, audience: 'program' as const, programId };
      } else {
        input = { ...common, audience: 'class' as const, classId };
      }

      if (isEdit && editingEvent) {
        await updateEvent.mutateAsync({ id: editingEvent.id, input });
        toast.success('Event updated');
      } else {
        await createEvent.mutateAsync(input);
        toast.success('Event created');
      }
      onOpenChange(false);
    } catch {
      toast.error(isEdit ? 'Could not update the event' : 'Could not create the event');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={isEdit ? 'Edit calendar entry' : 'New calendar entry'}>
      <div className="flex max-h-[70vh] flex-col gap-4 overflow-y-auto pr-1">
        <Field label="Title" htmlFor="event-title">
          <Input id="event-title" value={title} onChange={(e) => setTitle(e.target.value)} />
        </Field>
        <Field label="Description" htmlFor="event-description">
          <Textarea id="event-description" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        <Field label="Type" htmlFor="event-type">
          <Select id="event-type" value={type} onValueChange={(v) => setType(v as EventType)} options={typeOptions} />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Start" htmlFor="event-startAt">
            <Input id="event-startAt" type="datetime-local" value={startAt} onChange={(e) => setStartAt(e.target.value)} />
          </Field>
          <Field label="End (optional)" htmlFor="event-endAt">
            <Input id="event-endAt" type="datetime-local" value={endAt} onChange={(e) => setEndAt(e.target.value)} />
          </Field>
        </div>

        <label className="flex items-center gap-2 text-sm text-fg">
          <Checkbox checked={allDay} onCheckedChange={setAllDay} />
          All day
        </label>

        {isAdmin ? (
          <>
            <Field label="Applies to" htmlFor="event-audience">
              <Select
                id="event-audience"
                value={audience}
                onValueChange={(v) => setAudience(v as EventAudience)}
                options={[
                  { value: 'global', label: 'Everyone' },
                  { value: 'institution_type', label: 'School / College / University' },
                  { value: 'program', label: 'A specific program' },
                  { value: 'class', label: 'A specific semester / class' },
                ]}
              />
            </Field>
            {audience === 'institution_type' ? (
              <Field label="Institution type" htmlFor="event-institutionType">
                <Select
                  id="event-institutionType"
                  value={institutionType}
                  onValueChange={(v) => setInstitutionType(v as InstitutionType)}
                  options={institutionTypeOptions}
                />
              </Field>
            ) : null}
            {audience === 'program' ? (
              <Field label="Program" htmlFor="event-program">
                <Select
                  id="event-program"
                  value={programId}
                  onValueChange={setProgramId}
                  placeholder="Select a program"
                  options={(programs ?? []).map((p) => ({ value: p.id, label: p.name }))}
                />
              </Field>
            ) : null}
            {audience === 'class' ? (
              <Field label="Semester / class" htmlFor="event-class">
                <Select
                  id="event-class"
                  value={classId}
                  onValueChange={setClassId}
                  placeholder="Select a class"
                  options={(classes ?? []).map((c) => ({
                    value: c.id,
                    label: `${c.name} (${programs?.find((p) => p.id === c.programId)?.name ?? '—'})`,
                  }))}
                />
              </Field>
            ) : null}
          </>
        ) : (
          <Field label="Applies to your class" htmlFor="event-class">
            <Select
              id="event-class"
              value={classId}
              onValueChange={setClassId}
              placeholder="Select a class"
              options={myClasses.map((c) => ({ value: c.id, label: c.name }))}
            />
          </Field>
        )}

        <div className="mt-2 flex justify-between gap-3">
          <div>
            {isEdit && editingEvent ? (
              <Button
                type="button"
                variant="destructive"
                loading={deleteEvent.isPending}
                onClick={async () => {
                  if (window.confirm(`Delete "${editingEvent.title}"?`)) {
                    await deleteEvent.mutateAsync(editingEvent.id);
                    toast.success('Event deleted');
                    onOpenChange(false);
                  }
                }}
              >
                Delete
              </Button>
            ) : null}
          </div>
          <div className="flex gap-3">
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="button" loading={createEvent.isPending || updateEvent.isPending} onClick={onSubmit}>
              {isEdit ? 'Save changes' : 'Create'}
            </Button>
          </div>
        </div>
      </div>
    </Dialog>
  );
};
