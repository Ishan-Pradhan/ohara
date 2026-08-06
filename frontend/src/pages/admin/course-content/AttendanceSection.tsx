import { useState } from 'react';
import { CalendarCheck, Pencil, Plus, Trash2 } from 'lucide-react';

import {
  useAttendanceSessions,
  useAttendanceSummary,
  useAttendanceSession,
  useDeleteAttendanceSession,
} from '../../../features/attendance/useAttendance.js';
import { toast } from '../../../lib/toast.js';
import { Card } from '../../../components/ui/Card.js';
import { Button } from '../../../components/ui/Button.js';
import { Skeleton } from '../../../components/ui/Skeleton.js';
import { EmptyState } from '../../../components/ui/EmptyState.js';
import { Table, TableHead, TableBody, TableRow, TableHeadCell, TableCell } from '../../../components/ui/Table.js';
import { TakeAttendanceDialog } from './TakeAttendanceDialog.js';

interface AttendanceSectionProps {
  courseId: string;
}

export const AttendanceSection = ({ courseId }: AttendanceSectionProps) => {
  const { data: sessions, isLoading: sessionsLoading } = useAttendanceSessions(courseId);
  const { data: summary, isLoading: summaryLoading } = useAttendanceSummary(courseId);
  const deleteSession = useDeleteAttendanceSession(courseId);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const { data: editingSession } = useAttendanceSession(courseId, editingId ?? '');

  const roster = (summary ?? []).map((r) => ({ studentId: r.studentId, studentName: r.studentName }));

  const openNew = () => {
    setEditingId(null);
    setDialogOpen(true);
  };
  const openEdit = (id: string) => {
    setEditingId(id);
    setDialogOpen(true);
  };

  const onDelete = async (id: string) => {
    await deleteSession.mutateAsync(id);
    toast.success('Attendance session deleted');
  };

  if (sessionsLoading || summaryLoading) {
    return (
      <div className="flex flex-col gap-2">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-fg">Attendance</h2>
        <Button size="sm" onClick={openNew}>
          <Plus className="size-4" aria-hidden />
          Take attendance
        </Button>
      </div>

      {!summary || summary.length === 0 ? (
        <EmptyState
          icon={CalendarCheck}
          title="No students enrolled yet"
          description="Attendance can be taken once students are enrolled in this course."
        />
      ) : (
        <Card padding="sm">
          <h3 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-subtle">
            Percentage per student
          </h3>
          <Table>
            <TableHead>
              <TableRow>
                <TableHeadCell>Student</TableHeadCell>
                <TableHeadCell>Present</TableHeadCell>
                <TableHeadCell>Late</TableHeadCell>
                <TableHeadCell>Absent</TableHeadCell>
                <TableHeadCell>Percentage</TableHeadCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {summary.map((row) => (
                <TableRow key={row.studentId}>
                  <TableCell className="font-medium">{row.studentName}</TableCell>
                  <TableCell>{row.present}</TableCell>
                  <TableCell>{row.late}</TableCell>
                  <TableCell>{row.absent}</TableCell>
                  <TableCell className="font-medium">
                    {row.percentage === null ? <span className="text-subtle">—</span> : `${row.percentage.toFixed(0)}%`}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {!sessions || sessions.length === 0 ? (
        <EmptyState
          icon={CalendarCheck}
          title="No sessions taken yet"
          description="Click “Take attendance” to record present/absent/late for today."
        />
      ) : (
        <Card padding="sm">
          <h3 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-subtle">Sessions</h3>
          <div className="flex flex-col divide-y divide-border">
            {sessions.map((s) => (
              <div key={s.id} className="flex items-center justify-between gap-3 px-1 py-2.5">
                <span className="text-sm text-fg">{new Date(s.sessionDate).toLocaleDateString()}</span>
                <div className="flex items-center gap-1.5">
                  <Button variant="ghost" size="sm" onClick={() => openEdit(s.id)} aria-label="Edit session">
                    <Pencil className="size-4" aria-hidden />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onDelete(s.id)}
                    aria-label="Delete session"
                  >
                    <Trash2 className="size-4 text-danger" aria-hidden />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <TakeAttendanceDialog
        courseId={courseId}
        roster={roster}
        session={editingId ? (editingSession ?? null) : null}
        open={dialogOpen}
        onOpenChange={(next) => {
          setDialogOpen(next);
          if (!next) setEditingId(null);
        }}
      />
    </div>
  );
};
