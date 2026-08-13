import { BarChart3, ClipboardList, HelpCircle } from 'lucide-react';

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
import { SectionStats } from './SectionStats.js';

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

const scoreBadgeVariant = (score: number, maxScore: number): 'success' | 'accent' | 'danger' => {
  if (maxScore <= 0) return 'success';
  const pct = (score / maxScore) * 100;
  if (pct >= 80) return 'success';
  if (pct >= 60) return 'accent';
  return 'danger';
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

  const gradedCount = row.entries.filter((e) => e.status === 'graded').length;
  const pendingCount = row.entries.filter((e) => e.status === 'pending' || e.status === 'ungraded').length;

  return (
    <div className="flex flex-col gap-4">
      {gradeTrends && gradeTrends.length > 0 && <GradeTrendChart data={gradeTrends} />}

      <SectionStats
        stats={[
          {
            label: 'Overall average',
            value: row.average === null ? '—' : `${row.average.toFixed(1)}%`,
            tone: row.average === null ? 'default' : row.average >= 80 ? 'success' : row.average >= 60 ? 'accent' : 'danger',
          },
          { label: 'Graded', value: `${gradedCount} / ${row.entries.length}` },
          {
            label: 'Awaiting grade',
            value: String(pendingCount),
            tone: pendingCount > 0 ? 'warning' : 'default',
          },
        ]}
      />

      <div className="flex flex-col gap-2">
        {row.entries.map((entry) => {
          const Icon = entry.type === 'assignment' ? ClipboardList : HelpCircle;
          return (
            <Card key={entry.assessmentId} padding="sm" className="flex items-center gap-3">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-surface-hover text-subtle">
                <Icon className="size-4" aria-hidden />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-fg">
                  {titleById.get(entry.assessmentId) ?? (entry.type === 'assignment' ? 'Assignment' : 'Quiz')}
                </p>
                <p className="text-xs text-subtle capitalize">{entry.type}</p>
              </div>
              {entry.status === 'graded' ? (
                <Badge variant={scoreBadgeVariant(entry.score ?? 0, entry.maxScore)}>
                  {entry.score} / {entry.maxScore}
                </Badge>
              ) : (
                <Badge variant={entry.status === 'pending' ? 'warning' : 'neutral'}>
                  {statusLabel[entry.status]}
                </Badge>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
};
