import { Link } from 'react-router-dom';
import { HelpCircle } from 'lucide-react';

import { useQuizzes, useMyAttempt } from '../../features/quizzes/useQuizzes.js';
import type { Quiz } from '../../features/quizzes/quizzes.schema.js';
import { Badge } from '../../components/ui/Badge.js';
import { Card } from '../../components/ui/Card.js';
import { Skeleton } from '../../components/ui/Skeleton.js';
import { EmptyState } from '../../components/ui/EmptyState.js';

interface StudentQuizzesSectionProps {
  courseId: string;
}

const scoreBadgeVariant = (score: number, maxScore: number): 'success' | 'accent' | 'danger' => {
  if (maxScore <= 0) return 'success';
  const pct = (score / maxScore) * 100;
  if (pct >= 80) return 'success';
  if (pct >= 60) return 'accent';
  return 'danger';
};

const QuizRow = ({ courseId, quiz }: { courseId: string; quiz: Quiz }) => {
  const { data: attempt } = useMyAttempt(courseId, quiz.id);

  return (
    <Card padding="sm" className="flex items-center justify-between gap-3">
      <Link to={`/student/courses/${courseId}/quizzes/${quiz.id}`} className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-fg hover:underline">{quiz.title}</p>
      </Link>
      <Badge variant={attempt ? scoreBadgeVariant(attempt.score, attempt.maxScore) : 'neutral'}>
        {attempt ? `${attempt.score} / ${attempt.maxScore}` : 'Not attempted'}
      </Badge>
    </Card>
  );
};

export const StudentQuizzesSection = ({ courseId }: StudentQuizzesSectionProps) => {
  const { data: quizzes, isLoading } = useQuizzes(courseId);

  if (isLoading) {
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

  return (
    <div className="flex flex-col gap-2">
      {quizzes.map((quiz) => (
        <QuizRow key={quiz.id} courseId={courseId} quiz={quiz} />
      ))}
    </div>
  );
};
