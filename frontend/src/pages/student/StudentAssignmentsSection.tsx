import { Link } from 'react-router-dom';
import { ClipboardList } from 'lucide-react';

import { useAssignments } from '../../features/assignments/useAssignments.js';
import { useMyGrades } from '../../features/gradebook/useGradebook.js';
import type { Assignment } from '../../features/assignments/assignments.schema.js';
import type { GradebookEntry } from '../../features/gradebook/gradebook.schema.js';
import { Badge } from '../../components/ui/Badge.js';
import { Card } from '../../components/ui/Card.js';
import { Skeleton } from '../../components/ui/Skeleton.js';
import { EmptyState } from '../../components/ui/EmptyState.js';
import { SectionStats } from './SectionStats.js';

interface StudentAssignmentsSectionProps {
  courseId: string;
}

type Bucket = 'overdue' | 'open' | 'awaiting_grade' | 'graded';

interface Row {
  assignment: Assignment;
  totalPoints: number;
  status: GradebookEntry['status'];
  score: number | null;
  bucket: Bucket;
}

const bucketAccent: Record<Bucket, string> = {
  overdue: 'border-l-danger',
  open: 'border-l-transparent',
  awaiting_grade: 'border-l-warning',
  graded: 'border-l-success',
};

const bucketOrder: Record<Bucket, number> = { overdue: 0, open: 1, awaiting_grade: 2, graded: 3 };

const AssignmentRow = ({ courseId, row }: { courseId: string; row: Row }) => {
  const { assignment, totalPoints, status, score, bucket } = row;

  let badge: { variant: 'neutral' | 'warning' | 'success' | 'danger'; label: string };
  if (status === 'graded') {
    badge = { variant: 'success', label: `${score} / ${totalPoints}` };
  } else if (status === 'pending' || status === 'ungraded') {
    badge = { variant: 'warning', label: 'Submitted — awaiting grade' };
  } else {
    badge = bucket === 'overdue' ? { variant: 'danger', label: 'Overdue' } : { variant: 'neutral', label: 'Not submitted' };
  }

  return (
    <Card
      padding="sm"
      className={`flex items-center justify-between gap-3 border-l-2 ${bucketAccent[bucket]}`}
    >
      <Link to={`/student/courses/${courseId}/assignments/${assignment.id}`} className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-fg hover:underline">{assignment.title}</p>
        <p className="truncate text-xs text-muted">
          Due {new Date(assignment.dueAt).toLocaleString()} · {totalPoints} points
        </p>
      </Link>
      <Badge variant={badge.variant}>{badge.label}</Badge>
    </Card>
  );
};

export const StudentAssignmentsSection = ({ courseId }: StudentAssignmentsSectionProps) => {
  const { data: assignments, isLoading: assignmentsLoading } = useAssignments(courseId);
  const { data: gradeRow, isLoading: gradesLoading } = useMyGrades(courseId);

  if (assignmentsLoading || gradesLoading) {
    return (
      <div className="flex flex-col gap-2">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  if (!assignments || assignments.length === 0) {
    return (
      <EmptyState
        icon={ClipboardList}
        title="No assignments yet"
        description="Your teacher hasn't posted any assignments for this course."
      />
    );
  }

  const entryByAssessmentId = new Map((gradeRow?.entries ?? []).map((e) => [e.assessmentId, e]));
  const now = Date.now();

  const rows: Row[] = assignments.map((assignment) => {
    const totalPoints = assignment.rubric.reduce((sum, c) => sum + c.maxPoints, 0);
    const isPastDue = now > new Date(assignment.dueAt).getTime();
    const entry = entryByAssessmentId.get(assignment.id);
    const status = entry?.status ?? 'not_submitted';

    const bucket: Bucket =
      status === 'graded'
        ? 'graded'
        : status === 'pending' || status === 'ungraded'
          ? 'awaiting_grade'
          : isPastDue
            ? 'overdue'
            : 'open';

    return { assignment, totalPoints, status, score: entry?.score ?? null, bucket };
  });

  rows.sort((a, b) => {
    const bucketDiff = bucketOrder[a.bucket] - bucketOrder[b.bucket];
    if (bucketDiff !== 0) return bucketDiff;
    return new Date(a.assignment.dueAt).getTime() - new Date(b.assignment.dueAt).getTime();
  });

  const overdueCount = rows.filter((r) => r.bucket === 'overdue').length;
  const awaitingGradeCount = rows.filter((r) => r.bucket === 'awaiting_grade').length;

  return (
    <div className="flex flex-col gap-4">
      <SectionStats
        stats={[
          { label: 'Total assignments', value: String(assignments.length) },
          { label: 'Overdue', value: String(overdueCount), tone: overdueCount > 0 ? 'danger' : 'default' },
          {
            label: 'Awaiting grade',
            value: String(awaitingGradeCount),
            tone: awaitingGradeCount > 0 ? 'warning' : 'default',
          },
        ]}
      />

      <div className="flex flex-col gap-2">
        {rows.map((row) => (
          <AssignmentRow key={row.assignment.id} courseId={courseId} row={row} />
        ))}
      </div>
    </div>
  );
};
