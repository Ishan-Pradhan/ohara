import { BarChart3, ClipboardList, FileQuestion } from 'lucide-react';

import { useGradebook } from '../../../features/gradebook/useGradebook.js';
import type { GradebookEntry } from '../../../features/gradebook/gradebook.schema.js';
import { Badge } from '../../../components/ui/Badge.js';
import { Skeleton } from '../../../components/ui/Skeleton.js';
import { EmptyState } from '../../../components/ui/EmptyState.js';
import { Table, TableHead, TableBody, TableRow, TableHeadCell, TableCell } from '../../../components/ui/Table.js';
import { cn } from '../../../lib/cn.js';

interface GradebookSectionProps {
  courseId: string;
  /** Omitted -> the course's current batch. Given -> a specific past
   * batch's gradebook (viewing completed-course history). */
  batchId?: string;
}

const statusLabel: Record<GradebookEntry['status'], string> = {
  graded: '',
  pending: 'Pending review',
  ungraded: 'Ungraded',
  not_submitted: 'Not submitted',
  not_attempted: 'Not attempted',
};

const pctColor = (pct: number | null) => {
  if (pct === null) return 'text-muted';
  if (pct >= 80) return 'text-success';
  if (pct >= 60) return 'text-accent-fg';
  return 'text-danger';
};

const EntryCell = ({ entry }: { entry: GradebookEntry }) => {
  if (entry.status === 'graded') {
    const pct = entry.maxScore > 0 && entry.score !== null ? (entry.score / entry.maxScore) * 100 : null;
    return (
      <span className={pctColor(pct)}>
        {entry.score} / {entry.maxScore}
      </span>
    );
  }
  const variant = entry.status === 'pending' ? 'warning' : 'neutral';
  return <Badge variant={variant}>{statusLabel[entry.status]}</Badge>;
};

const StatTile = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-card border border-border bg-surface px-3 py-2">
    <p className="text-xs text-subtle">{label}</p>
    <p className="mt-1 text-sm font-semibold text-fg">{value}</p>
  </div>
);

export const GradebookSection = ({ courseId, batchId }: GradebookSectionProps) => {
  const { data: gradebook, isLoading } = useGradebook(courseId, batchId);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-2">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    );
  }

  if (!gradebook || gradebook.assessments.length === 0) {
    return (
      <EmptyState
        icon={BarChart3}
        title="Nothing to grade yet"
        description="Grades appear here once there's at least one assignment or published quiz."
      />
    );
  }

  const gradedAverages = gradebook.rows.map((r) => r.average).filter((a): a is number => a !== null);
  const classAverage =
    gradedAverages.length > 0 ? gradedAverages.reduce((a, b) => a + b, 0) / gradedAverages.length : null;

  const totalEntries = gradebook.rows.length * gradebook.assessments.length;
  const gradedEntries = gradebook.rows.reduce(
    (sum, row) => sum + row.entries.filter((e) => e.status === 'graded').length,
    0,
  );
  const completionRate = totalEntries > 0 ? (gradedEntries / totalEntries) * 100 : null;

  const assignmentCount = gradebook.assessments.filter((a) => a.type === 'assignment').length;
  const quizCount = gradebook.assessments.filter((a) => a.type === 'quiz').length;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="Class average" value={classAverage === null ? '—' : `${classAverage.toFixed(1)}%`} />
        <StatTile label="Graded" value={completionRate === null ? '—' : `${completionRate.toFixed(0)}%`} />
        <StatTile label="Students" value={String(gradebook.rows.length)} />
        <StatTile label="Assessments" value={`${assignmentCount} assignments · ${quizCount} quizzes`} />
      </div>

      <Table>
        <TableHead>
          <TableRow>
            <TableHeadCell>Student</TableHeadCell>
            {gradebook.assessments.map((assessment) => (
              <TableHeadCell key={assessment.id}>
                <span className="inline-flex items-center gap-1.5">
                  {assessment.type === 'quiz' ? (
                    <FileQuestion className="size-3 shrink-0 text-subtle" aria-hidden />
                  ) : (
                    <ClipboardList className="size-3 shrink-0 text-subtle" aria-hidden />
                  )}
                  <span className="normal-case">{assessment.title}</span>
                </span>
                <span className="ml-1 font-normal normal-case text-subtle">/{assessment.maxScore}</span>
              </TableHeadCell>
            ))}
            <TableHeadCell>Average</TableHeadCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {gradebook.rows.map((row) => (
            <TableRow key={row.studentId}>
              <TableCell className="font-medium">{row.studentName}</TableCell>
              {row.entries.map((entry) => (
                <TableCell key={entry.assessmentId}>
                  <EntryCell entry={entry} />
                </TableCell>
              ))}
              <TableCell className={cn('font-semibold', pctColor(row.average))}>
                {row.average === null ? <span className="text-subtle">—</span> : `${row.average.toFixed(1)}%`}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};
