import { BarChart3 } from 'lucide-react';

import { useMyGrades } from '../../features/gradebook/useGradebook.js';
import { useGradeTrends } from '../../features/trends/useTrends.js';
import type { GradebookEntry } from '../../features/gradebook/gradebook.schema.js';
import { useAssignments } from '../../features/assignments/useAssignments.js';
import { useQuizzes } from '../../features/quizzes/useQuizzes.js';
import { Badge } from '../../components/ui/Badge.js';
import { Card } from '../../components/ui/Card.js';
import { Skeleton } from '../../components/ui/Skeleton.js';
import { EmptyState } from '../../components/ui/EmptyState.js';
import { GradeTrendChart } from '../../components/charts/GradeTrendChart.js';

interface StudentGradesSectionProps {
  courseId: string;
}

const statusLabel: Record<GradebookEntry['status'], string> = {
  graded: '',
  pending: 'Pending review',
  ungraded: 'Ungraded',
  not_submitted: 'Not submitted',
  not_attempted: 'Not attempted',
};

export const StudentGradesSection = ({ courseId }: StudentGradesSectionProps) => {
  const { data: row, isLoading } = useMyGrades(courseId);
  const { data: gradeTrends } = useGradeTrends(courseId);
  // The gradebook row itself only carries assessmentId/type — join titles
  // client-side from the same lists the Assignments/Quizzes tabs already use.
  const { data: assignments } = useAssignments(courseId);
  const { data: quizzes } = useQuizzes(courseId);
  const titleById = new Map([
    ...(assignments ?? []).map((a) => [a.id, a.title] as const),
    ...(quizzes ?? []).map((q) => [q.id, q.title] as const),
  ]);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-2">
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-14 w-full" />
      </div>
    );
  }

  if (!row || row.entries.length === 0) {
    return (
      <EmptyState
        icon={BarChart3}
        title="No grades yet"
        description="Grades appear here once there's an assignment or quiz to be graded on."
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {gradeTrends && gradeTrends.length > 0 && <GradeTrendChart data={gradeTrends} />}

      <Card padding="sm" className="flex items-center justify-between">
        <span className="text-sm font-medium text-fg">Overall average</span>
        <span className="text-lg font-semibold text-fg">
          {row.average === null ? '—' : `${row.average.toFixed(1)}%`}
        </span>
      </Card>

      <div className="flex flex-col gap-2">
        {row.entries.map((entry) => (
          <Card key={entry.assessmentId} padding="sm" className="flex items-center justify-between gap-3">
            <div>
              <span className="text-sm text-fg">
                {titleById.get(entry.assessmentId) ?? (entry.type === 'assignment' ? 'Assignment' : 'Quiz')}
              </span>
              <p className="text-xs text-subtle">{entry.type === 'assignment' ? 'Assignment' : 'Quiz'}</p>
            </div>
            {entry.status === 'graded' ? (
              <Badge variant="success">
                {entry.score} / {entry.maxScore}
              </Badge>
            ) : (
              <Badge variant={entry.status === 'pending' ? 'warning' : 'neutral'}>
                {statusLabel[entry.status]}
              </Badge>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
};
