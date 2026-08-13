import { Link } from 'react-router-dom';
import { HelpCircle } from 'lucide-react';

import { useQuizzes } from '../../features/quizzes/useQuizzes.js';
import { useMyGrades } from '../../features/gradebook/useGradebook.js';
import type { Quiz } from '../../features/quizzes/quizzes.schema.js';
import type { GradebookEntry } from '../../features/gradebook/gradebook.schema.js';
import { Badge } from '../../components/ui/Badge.js';
import { Card } from '../../components/ui/Card.js';
import { Skeleton } from '../../components/ui/Skeleton.js';
import { EmptyState } from '../../components/ui/EmptyState.js';
import { SectionStats } from './SectionStats.js';

interface StudentQuizzesSectionProps {
  courseId: string;
  /** Set when viewing a completed course — see StudentCoursePage. */
  batchId?: string;
  readOnly?: boolean;
}

interface Row {
  quiz: Quiz;
  status: GradebookEntry['status'];
  score: number | null;
  maxScore: number;
}

const rowOrder: Record<GradebookEntry['status'], number> = {
  not_attempted: 0,
  pending: 1,
  ungraded: 1,
  graded: 2,
  not_submitted: 3, // not a quiz status in practice, kept for exhaustiveness
};

const QuizRow = ({ courseId, row }: { courseId: string; row: Row }) => {
  const { quiz, status, score, maxScore } = row;

  let badge: { variant: 'neutral' | 'warning' | 'success' | 'accent' | 'danger'; label: string };
  if (status === 'graded') {
    const pct = maxScore > 0 ? (score! / maxScore) * 100 : 100;
    badge = {
      variant: pct >= 80 ? 'success' : pct >= 60 ? 'accent' : 'danger',
      label: `${score} / ${maxScore}`,
    };
  } else if (status === 'pending' || status === 'ungraded') {
    badge = { variant: 'warning', label: 'Awaiting grade' };
  } else {
    badge = { variant: 'neutral', label: 'Not attempted' };
  }

  return (
    <Card
      padding="sm"
      className={`flex items-center justify-between gap-3 border-l-2 ${
        status === 'not_attempted' ? 'border-l-primary/40' : 'border-l-transparent'
      }`}
    >
      <Link to={`/student/courses/${courseId}/quizzes/${quiz.id}`} className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-fg hover:underline">{quiz.title}</p>
      </Link>
      <Badge variant={badge.variant}>{badge.label}</Badge>
    </Card>
  );
};

export const StudentQuizzesSection = ({ courseId, batchId }: StudentQuizzesSectionProps) => {
  const { data: quizzes, isLoading: quizzesLoading } = useQuizzes(courseId, batchId);
  const { data: gradeRow, isLoading: gradesLoading } = useMyGrades(courseId);

  if (quizzesLoading || gradesLoading) {
    return (
      <div className="flex flex-col gap-2">
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-14 w-full" />
      </div>
    );
  }

  if (!quizzes || quizzes.length === 0) {
    return (
      <EmptyState
        icon={HelpCircle}
        title="No quizzes yet"
        description="Your teacher hasn't published any quizzes for this course."
      />
    );
  }

  const entryByAssessmentId = new Map((gradeRow?.entries ?? []).map((e) => [e.assessmentId, e]));

  const rows: Row[] = quizzes.map((quiz) => {
    const entry = entryByAssessmentId.get(quiz.id);
    return {
      quiz,
      status: entry?.status ?? 'not_attempted',
      score: entry?.score ?? null,
      maxScore: entry?.maxScore ?? 0,
    };
  });

  rows.sort((a, b) => rowOrder[a.status] - rowOrder[b.status]);

  const notAttemptedCount = rows.filter((r) => r.status === 'not_attempted').length;
  const gradedScores = rows.filter((r) => r.status === 'graded');
  const averagePct =
    gradedScores.length > 0
      ? gradedScores.reduce((sum, r) => sum + (r.maxScore > 0 ? (r.score! / r.maxScore) * 100 : 100), 0) /
        gradedScores.length
      : null;

  return (
    <div className="flex flex-col gap-4">
      <SectionStats
        stats={[
          { label: 'Total quizzes', value: String(quizzes.length) },
          {
            label: 'Not attempted',
            value: String(notAttemptedCount),
            tone: notAttemptedCount > 0 ? 'warning' : 'default',
          },
          {
            label: 'Average score',
            value: averagePct === null ? '—' : `${averagePct.toFixed(0)}%`,
            tone: averagePct === null ? 'default' : averagePct >= 80 ? 'success' : averagePct >= 60 ? 'accent' : 'danger',
          },
        ]}
      />

      <div className="flex flex-col gap-2">
        {rows.map((row) => (
          <QuizRow key={row.quiz.id} courseId={courseId} row={row} />
        ))}
      </div>
    </div>
  );
};
