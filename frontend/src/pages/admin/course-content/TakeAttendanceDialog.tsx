import { useEffect, useMemo, useState } from 'react';

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
import { Badge } from '../../../components/ui/Badge.js';
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
  const [reasons, setReasons] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open) return;
    setSessionDate(session?.sessionDate ?? today());
    const initial: Record<string, AttendanceStatus> = {};
    const initialReasons: Record<string, string> = {};
    for (const entry of roster) {
      const existing = session?.records.find((r) => r.studentId === entry.studentId);
      initial[entry.studentId] = existing?.status ?? 'present';
      if (existing?.reason) initialReasons[entry.studentId] = existing.reason;
    }
    setStatuses(initial);
    setReasons(initialReasons);
  }, [open, session, roster]);

  const mutation = session ? updateSession : createSession;
  const error = mutation.error;

  const counts = useMemo(() => {
    let present = 0;
    let late = 0;
    let absent = 0;
    for (const entry of roster) {
      const s = statuses[entry.studentId] ?? 'present';
      if (s === 'present') present++;
      else if (s === 'late') late++;
      else absent++;
    }
    return { present, late, absent };
  }, [roster, statuses]);

  const markAll = (status: AttendanceStatus) => {
    const next: Record<string, AttendanceStatus> = {};
    for (const entry of roster) {
      next[entry.studentId] = status;
    }
    setStatuses(next);
  };

  const onSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const records = roster.map((r) => ({
      studentId: r.studentId,
      status: statuses[r.studentId] ?? 'present',
      reason: reasons[r.studentId] || undefined,
    }));
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
      <form onSubmit={onSubmit} className="flex max-h-[70vh] flex-col gap-4 overflow-y-auto pr-1">
        {error instanceof ApiError ? <Alert>{error.message}</Alert> : null}

        <Field label="Date" htmlFor="sessionDate">
          <Input
            id="sessionDate"
            type="date"
            value={sessionDate}
            onChange={(e) => setSessionDate(e.target.value)}
            disabled={Boolean(session)}
            max={today()}
          />
        </Field>

        {roster.length === 0 ? (
          <p className="text-sm text-muted">No students in this section are enrolled in this course yet.</p>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <Button type="button" variant="secondary" size="sm" onClick={() => markAll('present')}>
                All present
              </Button>
              <Button type="button" variant="secondary" size="sm" onClick={() => markAll('late')}>
                All late
              </Button>
              <Button type="button" variant="secondary" size="sm" onClick={() => markAll('absent')}>
                All absent
              </Button>
              <div className="ml-auto flex items-center gap-1.5 text-xs text-muted">
                <Badge variant="success">{counts.present}</Badge>
                <Badge variant="warning">{counts.late}</Badge>
                <Badge variant="danger">{counts.absent}</Badge>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              {roster.map((entry) => {
                const currentStatus = statuses[entry.studentId] ?? 'present';
                const showReason = currentStatus === 'absent' || currentStatus === 'late';
                return (
                  <div
                    key={entry.studentId}
                    className="rounded-control border border-border p-2.5"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="truncate text-sm font-medium text-fg">{entry.studentName}</span>
                      <div className="flex shrink-0 gap-1.5">
                        {statusOptions.map((opt) => (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => setStatuses((prev) => ({ ...prev, [entry.studentId]: opt.value }))}
                            className={cn(
                              'rounded-pill border px-2.5 py-1 text-xs font-medium transition-colors',
                              currentStatus === opt.value
                                ? statusStyles[opt.value]
                                : 'border-border text-muted hover:bg-surface-hover',
                            )}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    {showReason && (
                      <input
                        type="text"
                        placeholder={currentStatus === 'absent' ? 'Reason for absence (optional)' : 'Reason for late (optional)'}
                        value={reasons[entry.studentId] ?? ''}
                        onChange={(e) => setReasons((prev) => ({ ...prev, [entry.studentId]: e.target.value }))}
                        className="mt-2 w-full rounded-control border border-border bg-surface px-2.5 py-1.5 text-xs text-fg placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent/40"
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}

        <div className="mt-2 flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="submit"
            loading={mutation.isPending}
            disabled={roster.length === 0}
          >
            {session ? 'Save changes' : 'Save attendance'}
          </Button>
        </div>
      </form>
    </Dialog>
  );
};
