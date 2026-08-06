import { useEffect, useState } from 'react';

import type { AttendanceSession, AttendanceStatus } from '../../../features/attendance/attendance.schema.js';
import {
  useCreateAttendanceSession,
  useUpdateAttendanceSession,
} from '../../../features/attendance/useAttendance.js';
import { ApiError } from '../../../lib/apiError.js';
import { toast } from '../../../lib/toast.js';
import { Dialog } from '../../../components/ui/Dialog.js';
import { Button } from '../../../components/ui/Button.js';
import { Field } from '../../../components/ui/Field.js';
import { Input } from '../../../components/ui/Input.js';
import { Alert } from '../../../components/ui/Alert.js';
import { cn } from '../../../lib/cn.js';

interface RosterEntry {
  studentId: string;
  studentName: string;
}

interface TakeAttendanceDialogProps {
  courseId: string;
  sectionId: string;
  roster: RosterEntry[];
  session: AttendanceSession | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const today = () => new Date().toISOString().slice(0, 10);

const statusOptions: { value: AttendanceStatus; label: string }[] = [
  { value: 'present', label: 'Present' },
  { value: 'late', label: 'Late' },
  { value: 'absent', label: 'Absent' },
];

const statusStyles: Record<AttendanceStatus, string> = {
  present: 'bg-success-soft text-success border-success/30',
  late: 'bg-warning-soft text-accent-fg border-warning/40',
  absent: 'bg-danger-soft text-danger border-danger/30',
};

export const TakeAttendanceDialog = ({
  courseId,
  sectionId,
  roster,
  session,
  open,
  onOpenChange,
}: TakeAttendanceDialogProps) => {
  const createSession = useCreateAttendanceSession(courseId);
  const updateSession = useUpdateAttendanceSession(courseId);
  const [sessionDate, setSessionDate] = useState(today());
  const [statuses, setStatuses] = useState<Record<string, AttendanceStatus>>({});

  useEffect(() => {
    if (!open) return;
    setSessionDate(session?.sessionDate ?? today());
    const initial: Record<string, AttendanceStatus> = {};
    for (const entry of roster) {
      const existing = session?.records.find((r) => r.studentId === entry.studentId);
      initial[entry.studentId] = existing?.status ?? 'present';
    }
    setStatuses(initial);
  }, [open, session, roster]);

  const mutation = session ? updateSession : createSession;
  const error = mutation.error;

  const onSubmit = async () => {
    const records = roster.map((r) => ({ studentId: r.studentId, status: statuses[r.studentId] ?? 'present' }));
    try {
      if (session) {
        await updateSession.mutateAsync({ id: session.id, records });
        toast.success('Attendance updated');
      } else {
        await createSession.mutateAsync({ sectionId, sessionDate, records });
        toast.success('Attendance recorded');
      }
      onOpenChange(false);
    } catch {
      // error already surfaced via `error` below
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={session ? 'Edit attendance' : 'Take attendance'}
      description="Mark every enrolled student, then save."
    >
      <div className="flex max-h-[70vh] flex-col gap-4 overflow-y-auto pr-1">
        {error instanceof ApiError ? <Alert>{error.message}</Alert> : null}

        <Field label="Date" htmlFor="sessionDate">
          <Input
            id="sessionDate"
            type="date"
            value={sessionDate}
            onChange={(e) => setSessionDate(e.target.value)}
            disabled={Boolean(session)}
          />
        </Field>

        {roster.length === 0 ? (
          <p className="text-sm text-muted">No students in this section are enrolled in this course yet.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {roster.map((entry) => (
              <div
                key={entry.studentId}
                className="flex items-center justify-between gap-3 rounded-control border border-border p-2.5"
              >
                <span className="truncate text-sm font-medium text-fg">{entry.studentName}</span>
                <div className="flex shrink-0 gap-1.5">
                  {statusOptions.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setStatuses((prev) => ({ ...prev, [entry.studentId]: opt.value }))}
                      className={cn(
                        'rounded-pill border px-2.5 py-1 text-xs font-medium transition-colors',
                        statuses[entry.studentId] === opt.value
                          ? statusStyles[opt.value]
                          : 'border-border text-muted hover:bg-surface-hover',
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-2 flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            loading={mutation.isPending}
            disabled={roster.length === 0}
            onClick={onSubmit}
          >
            {session ? 'Save changes' : 'Save attendance'}
          </Button>
        </div>
      </div>
    </Dialog>
  );
};
