import { useEffect, useMemo, useState } from 'react';
import { CalendarCheck, ChevronLeft, ChevronRight, Pencil, Plus, Search, Trash2, ArrowUpDown } from 'lucide-react';

import {
  useAttendanceSections,
  useAttendanceSessions,
  useAttendanceSummary,
  useAttendanceSession,
  useAttendanceRoster,
  useDeleteAttendanceSession,
} from '../../../features/attendance/useAttendance.js';
import { useAttendanceTrends } from '../../../features/trends/useTrends.js';
import { toast } from '../../../lib/toast.js';
import { Card } from '../../../components/ui/Card.js';
import { Button } from '../../../components/ui/Button.js';
import { Input } from '../../../components/ui/Input.js';
import { Select } from '../../../components/ui/Select.js';
import { Skeleton } from '../../../components/ui/Skeleton.js';
import { EmptyState } from '../../../components/ui/EmptyState.js';
import { ConfirmDialog } from '../../../components/ui/Dialog.js';
import { AttendanceTrendChart } from '../../../components/charts/AttendanceTrendChart.js';
import { TakeAttendanceDialog } from './TakeAttendanceDialog.js';

interface AttendanceSectionProps {
  courseId: string;
  /** When provided (even as empty string), the parent controls section selection and the internal section selector is hidden. When undefined, the component manages its own section. */
  externalSectionId?: string;
  /** When true, the component is used inside a parent that has its own section selector (e.g. admin cascading filters). Hides the internal section selector entirely. */
  hasExternalSectionSelector?: boolean;
}

type SortKey = 'name' | 'percentage' | 'present' | 'late' | 'absent';
type SortDir = 'asc' | 'desc';

const PAGE_SIZE = 20;

const pctColor = (pct: number | null) => {
  if (pct === null) return 'text-muted';
  if (pct >= 80) return 'text-success';
  if (pct >= 60) return 'text-accent-fg';
  return 'text-danger';
};

export const AttendanceSection = ({ courseId, externalSectionId, hasExternalSectionSelector }: AttendanceSectionProps) => {
  const { data: sectionOptions, isLoading: sectionOptionsLoading } = useAttendanceSections(courseId);
  const [internalSectionId, setInternalSectionId] = useState('');

  // Determine the effective section ID and whether we control the selector
  const controlled = hasExternalSectionSelector || externalSectionId !== undefined;
  const selectedSectionId = controlled ? (externalSectionId || '') : internalSectionId;

  useEffect(() => {
    if (!controlled && !internalSectionId && sectionOptions && sectionOptions.length > 0) {
      setInternalSectionId(sectionOptions[0]!.id);
    }
  }, [sectionOptions, internalSectionId, controlled]);

  const { data: sessions, isLoading: sessionsLoading } = useAttendanceSessions(courseId, selectedSectionId || undefined);
  const { data: summary, isLoading: summaryLoading } = useAttendanceSummary(courseId, selectedSectionId || undefined);
  const { data: roster } = useAttendanceRoster(courseId, selectedSectionId);
  const { data: attendanceTrends } = useAttendanceTrends(courseId);
  const deleteSession = useDeleteAttendanceSession(courseId);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const { data: editingSession } = useAttendanceSession(courseId, editingId ?? '');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('percentage');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [page, setPage] = useState(1);

  const sectionName = (id: string | null) => sectionOptions?.find((s) => s.id === id)?.name ?? '—';

  const openNew = () => {
    setEditingId(null);
    setDialogOpen(true);
  };
  const openEdit = (id: string) => {
    setEditingId(id);
    setDialogOpen(true);
  };

  const onDelete = async () => {
    if (!deletingId) return;
    await deleteSession.mutateAsync(deletingId);
    toast.success('Attendance session deleted');
    setDeletingId(null);
  };

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir(key === 'name' ? 'asc' : 'asc');
    }
    setPage(1);
  };

  const filteredAndSorted = useMemo(() => {
    const rows = [...(summary ?? [])];

    const q = search.toLowerCase().trim();
    const filtered = q ? rows.filter((r) => r.studentName.toLowerCase().includes(q)) : rows;

    filtered.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case 'name':
          cmp = a.studentName.localeCompare(b.studentName);
          break;
        case 'percentage':
          cmp = (a.percentage ?? -1) - (b.percentage ?? -1);
          break;
        case 'present':
          cmp = a.present - b.present;
          break;
        case 'late':
          cmp = a.late - b.late;
          break;
        case 'absent':
          cmp = a.absent - b.absent;
          break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return filtered;
  }, [summary, search, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filteredAndSorted.length / PAGE_SIZE));
  const pageRows = filteredAndSorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const sortedSessions = [...(sessions ?? [])].sort((a, b) =>
    new Date(b.sessionDate).getTime() - new Date(a.sessionDate).getTime(),
  );

  if (sectionOptionsLoading || sessionsLoading || summaryLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!sectionOptions || sectionOptions.length === 0) {
    return (
      <EmptyState
        icon={CalendarCheck}
        title="No sections yet for this class"
        description="Ask an admin to create a section under this course's class before attendance can be taken — attendance is per section, since a course can be taught to more than one."
      />
    );
  }

  const SortHeader = ({ label, field }: { label: string; field: SortKey }) => (
    <button
      type="button"
      onClick={() => toggleSort(field)}
      className="flex items-center gap-1 text-left text-xs font-semibold uppercase tracking-wide text-subtle hover:text-fg"
    >
      {label}
      <ArrowUpDown className={`size-3 ${sortKey === field ? 'text-primary' : 'text-subtle'}`} />
    </button>
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3">
        {!controlled ? (
          <div className="max-w-xs">
            <Select
              value={internalSectionId}
              onValueChange={setInternalSectionId}
              options={sectionOptions.map((s) => ({ value: s.id, label: `Section ${s.name}` }))}
              placeholder="Select a section"
            />
          </div>
        ) : (
          <div />
        )}
        <Button size="sm" onClick={openNew} disabled={!selectedSectionId}>
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
        <Card padding="none">
          <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-subtle">
              {selectedSectionId ? `Attendance — Section ${sectionName(selectedSectionId)}` : 'Attendance by student (whole course)'}
            </h3>
            <div className="relative max-w-xs">
              <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-subtle" />
              <Input
                placeholder="Search students…"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                className="h-8 pl-8 text-sm"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-hover">
                  <th className="px-4 py-2.5">
                    <SortHeader label="Student" field="name" />
                  </th>
                  <th className="px-4 py-2.5">
                    <SortHeader label="Present" field="present" />
                  </th>
                  <th className="px-4 py-2.5">
                    <SortHeader label="Late" field="late" />
                  </th>
                  <th className="px-4 py-2.5">
                    <SortHeader label="Absent" field="absent" />
                  </th>
                  <th className="px-4 py-2.5">
                    <SortHeader label=" %" field="percentage" />
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {pageRows.map((row) => (
                  <tr key={row.studentId} className="transition-colors hover:bg-surface-hover/60">
                    <td className="px-4 py-2.5 font-medium text-fg">{row.studentName}</td>
                    <td className="px-4 py-2.5 text-fg">{row.present}</td>
                    <td className="px-4 py-2.5 text-fg">{row.late}</td>
                    <td className="px-4 py-2.5 text-fg">{row.absent}</td>
                    <td className="px-4 py-2.5">
                      <span className={`font-semibold ${pctColor(row.percentage)}`}>
                        {row.percentage === null ? '—' : `${row.percentage.toFixed(0)}%`}
                      </span>
                    </td>
                  </tr>
                ))}
                {pageRows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-sm text-muted">
                      No students match "{search}"
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          {filteredAndSorted.length > PAGE_SIZE ? (
            <div className="flex items-center justify-between border-t border-border px-4 py-2.5">
              <span className="text-xs text-muted">
                {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filteredAndSorted.length)} of{' '}
                {filteredAndSorted.length}
              </span>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  <ChevronLeft className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  <ChevronRight className="size-4" />
                </Button>
              </div>
            </div>
          ) : null}
        </Card>
      )}

      {!sessions || sessions.length === 0 ? (
        <EmptyState
          icon={CalendarCheck}
          title="No sessions taken yet"
          description='Pick a section above, then click "Take attendance" to record present/absent/late for today.'
        />
      ) : (
        <div>
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-subtle">Sessions</h3>
          <Card padding="none">
            <div className="flex flex-col divide-y divide-border">
              {sortedSessions.map((s) => (
                <div key={s.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-fg">
                      {new Date(s.sessionDate).toLocaleDateString(undefined, {
                        weekday: 'short',
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </p>
                    <p className="text-xs text-subtle">Section {sectionName(s.sectionId)}</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEdit(s.id)}
                      aria-label="Edit session"
                      disabled={!s.sectionId}
                      title={!s.sectionId ? 'No section assigned' : 'Edit session'}
                    >
                      <Pencil className="size-4" aria-hidden />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDeletingId(s.id)}
                      aria-label="Delete session"
                    >
                      <Trash2 className="size-4 text-danger" aria-hidden />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {attendanceTrends ? (
        <AttendanceTrendChart data={attendanceTrends} />
      ) : null}

      <TakeAttendanceDialog
        courseId={courseId}
        sectionId={editingId ? (editingSession?.sectionId ?? selectedSectionId) : selectedSectionId}
        roster={roster ?? []}
        session={editingId ? (editingSession ?? null) : null}
        open={dialogOpen}
        onOpenChange={(next) => {
          setDialogOpen(next);
          if (!next) setEditingId(null);
        }}
      />

      <ConfirmDialog
        open={deletingId !== null}
        onOpenChange={(open) => { if (!open) setDeletingId(null); }}
        title="Delete attendance session?"
        description="This will permanently remove the attendance records for this session. This action cannot be undone."
        confirmLabel="Delete"
        destructive
        loading={deleteSession.isPending}
        onConfirm={onDelete}
      />
    </div>
  );
};
