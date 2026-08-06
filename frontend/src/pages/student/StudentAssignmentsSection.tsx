import { Link } from 'react-router-dom';
import { ClipboardList } from 'lucide-react';

import { useAssignments, useMySubmission } from '../../features/assignments/useAssignments.js';
import type { Assignment } from '../../features/assignments/assignments.schema.js';
import { Badge } from '../../components/ui/Badge.js';
import { Card } from '../../components/ui/Card.js';
import { Skeleton } from '../../components/ui/Skeleton.js';
import { EmptyState } from '../../components/ui/EmptyState.js';

interface StudentAssignmentsSectionProps {
  courseId: string;
}

const AssignmentRow = ({ courseId, assignment }: { courseId: string; assignment: Assignment }) => {
  const { data: submission } = useMySubmission(courseId, assignment.id);
  const totalPoints = assignment.rubric.reduce((sum, c) => sum + c.maxPoints, 0);

  let badge: { variant: 'neutral' | 'warning' | 'success'; label: string };
  if (!submission) {
    badge = { variant: 'neutral', label: 'Not submitted' };
  } else if (submission.grade) {
    badge = { variant: 'success', label: `${submission.grade.score} / ${totalPoints}` };
  } else {
    badge = { variant: 'warning', label: 'Submitted — awaiting grade' };
  }

  return (
    <Card padding="sm" className="flex items-center justify-between gap-3">
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
  const { data: assignments, isLoading } = useAssignments(courseId);

  if (isLoading) {
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

  return (
    <div className="flex flex-col gap-2">
      {assignments.map((assignment) => (
        <AssignmentRow key={assignment.id} courseId={courseId} assignment={assignment} />
      ))}
    </div>
  );
};
