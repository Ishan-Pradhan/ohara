import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';

import { useQuiz, useMyAttempt, useSubmitAttempt } from '../../features/quizzes/useQuizzes.js';
import { useCurrentUser } from '../../features/auth/useAuth.js';
import { useStudentPastCourses, useStudentPlacement } from '../../features/placement/usePlacement.js';
import { ApiError } from '../../lib/apiError.js';
import { toast } from '../../lib/toast.js';
import { AppShell } from '../../components/layout/AppShell.js';
import { PageHeader } from '../../components/layout/PageHeader.js';
import { Badge } from '../../components/ui/Badge.js';
import { Button } from '../../components/ui/Button.js';
import { Card } from '../../components/ui/Card.js';
import { Checkbox } from '../../components/ui/Checkbox.js';
import { Textarea } from '../../components/ui/Textarea.js';
import { Skeleton } from '../../components/ui/Skeleton.js';
import { Alert } from '../../components/ui/Alert.js';
import { ConfirmDialog } from '../../components/ui/Dialog.js';
import { cn } from '../../lib/cn.js';

const scoreBadgeVariant = (score: number, maxScore: number): 'success' | 'accent' | 'danger' => {
  if (maxScore <= 0) return 'success';
  const pct = (score / maxScore) * 100;
  if (pct >= 80) return 'success';
  if (pct >= 60) return 'accent';
  return 'danger';
};

export const QuizTakePage = () => {
  const { courseId = '', quizId = '' } = useParams();
  const { data: quiz, isLoading } = useQuiz(courseId, quizId);
  const { data: attempt } = useMyAttempt(courseId, quizId);
  const submitAttempt = useSubmitAttempt(courseId, quizId);

  const { data: currentUser } = useCurrentUser();
  const studentId = currentUser?.id ?? '';
  const { data: placement } = useStudentPlacement(studentId);
  const { data: pastCourses } = useStudentPastCourses(studentId);
  // Attempting is already blocked server-side once this course's enrollment
  // is 'completed' (requireEnrolledStudent stays active-only) — this just
  // replaces the interactive form with an explanation instead of a
  // confusing 403.
  const isPastCourse =
    !placement?.courses.some((c) => c.id === courseId) &&
    Boolean(pastCourses?.some((c) => c.id === courseId));
  const canAttempt = !attempt && !isPastCourse;

  const [answers, setAnswers] = useState<Record<string, number | string>>({});
  const [confirmOpen, setConfirmOpen] = useState(false);

  const questions = quiz?.questions ?? [];
  const resultsByQuestion = new Map((attempt?.results ?? []).map((r) => [r.questionId, r]));
  const answeredCount = questions.filter((q) => {
    const a = answers[q.id];
    return a !== undefined && !(typeof a === 'string' && a.trim() === '');
  }).length;

  const requestSubmit = () => {
    if (answeredCount === 0) {
      toast.error('Answer at least one question first');
      return;
    }
    setConfirmOpen(true);
  };

  const onSubmit = async () => {
    const responses = Object.entries(answers).map(([questionId, answer]) => ({ questionId, answer }));
    try {
      await submitAttempt.mutateAsync({ responses });
      setConfirmOpen(false);
      toast.success('Quiz submitted');
    } catch (caught) {
      setConfirmOpen(false);
      toast.error(caught instanceof ApiError ? caught.message : 'Could not submit quiz');
    }
  };

  return (
    <AppShell>
      <Link
        to={`/student/courses/${courseId}`}
        className="mb-1 flex items-center gap-1 text-sm text-muted hover:text-fg"
      >
        <ChevronLeft className="size-3.5" aria-hidden />
        Back to course
      </Link>

      {isLoading || !quiz ? (
        <Skeleton className="h-10 w-64" />
      ) : (
        <PageHeader
          title={quiz.title}
          description={`${questions.length} question${questions.length === 1 ? '' : 's'}`}
          actions={
            attempt ? (
              <Badge variant={scoreBadgeVariant(attempt.score, attempt.maxScore)}>
                Score: {attempt.score} / {attempt.maxScore}
              </Badge>
            ) : undefined
          }
        />
      )}

      {submitAttempt.error instanceof ApiError ? (
        <div className="mb-4">
          <Alert>{submitAttempt.error.message}</Alert>
        </div>
      ) : null}

      {canAttempt && questions.length > 0 ? (
        <div className="mb-4 flex items-center gap-3">
          <div className="h-1.5 flex-1 overflow-hidden rounded-pill bg-surface-hover">
            <div
              className="h-full rounded-pill bg-primary transition-[width] duration-300 ease-out"
              style={{ width: `${(answeredCount / questions.length) * 100}%` }}
            />
          </div>
          <span className="shrink-0 text-xs text-subtle">
            {answeredCount} / {questions.length} answered
          </span>
        </div>
      ) : null}

      {isPastCourse && !attempt ? (
        <div className="mb-4">
          <Alert>This semester is complete — this quiz was never attempted, and attempting is now closed.</Alert>
        </div>
      ) : null}

      <div className="flex flex-col gap-4">
        {questions.map((question, index) => {
          const result = resultsByQuestion.get(question.id);
          return (
            <Card key={question.id}>
              <p className="mb-3 text-sm font-medium text-fg">
                {index + 1}. {question.prompt}
              </p>

              {question.type === 'mcq' && question.options ? (
                <div className="flex flex-col gap-2">
                  {question.options.map((option, optionIndex) => {
                    const isSelected = attempt
                      ? result?.answer === optionIndex
                      : answers[question.id] === optionIndex;
                    const isCorrectOption = attempt && question.correctIndex === optionIndex;
                    return (
                      <label
                        key={optionIndex}
                        className={cn(
                          'flex items-center gap-2 rounded-control border px-3 py-2 text-sm',
                          isCorrectOption
                            ? 'border-success/40 bg-success-soft text-success'
                            : isSelected
                              ? 'border-primary/40 bg-primary-soft text-primary'
                              : 'border-border text-fg',
                        )}
                      >
                        <Checkbox
                          checked={Boolean(isSelected)}
                          disabled={Boolean(attempt) || isPastCourse}
                          onCheckedChange={() =>
                            setAnswers((prev) => ({ ...prev, [question.id]: optionIndex }))
                          }
                        />
                        {option}
                      </label>
                    );
                  })}
                </div>
              ) : attempt ? (
                <p
                  className={cn(
                    'rounded-control border px-3 py-2 text-sm',
                    result?.grade?.status === 'approved'
                      ? scoreBadgeVariant(result.grade.awardedPoints ?? 0, result.grade.maxPoints ?? 0) === 'success'
                        ? 'border-success/40 bg-success-soft text-fg'
                        : scoreBadgeVariant(result.grade.awardedPoints ?? 0, result.grade.maxPoints ?? 0) === 'danger'
                          ? 'border-danger/40 bg-danger-soft text-fg'
                          : 'border-accent/40 bg-accent-soft text-fg'
                      : 'border-warning/40 bg-warning-soft text-fg',
                  )}
                >
                  {String(result?.answer ?? '—')}
                </p>
              ) : isPastCourse ? (
                <p className="rounded-control border border-border px-3 py-2 text-sm text-muted">
                  Not attempted
                </p>
              ) : (
                <Textarea
                  rows={3}
                  placeholder="Your answer…"
                  value={typeof answers[question.id] === 'string' ? (answers[question.id] as string) : ''}
                  onChange={(e) => setAnswers((prev) => ({ ...prev, [question.id]: e.target.value }))}
                />
              )}

              <div className="mt-2 flex items-center gap-2 text-xs text-subtle">
                <span>{question.points} pt{question.points === 1 ? '' : 's'}</span>
                {attempt && question.type === 'mcq' ? (
                  <Badge variant={result?.correct ? 'success' : 'danger'}>
                    {result?.correct ? 'Correct' : 'Incorrect'}
                  </Badge>
                ) : attempt && result?.grade?.status === 'approved' ? (
                  <Badge variant={scoreBadgeVariant(result.grade.awardedPoints ?? 0, result.grade.maxPoints ?? 0)}>
                    {result.grade.awardedPoints} / {result.grade.maxPoints}
                  </Badge>
                ) : attempt ? (
                  <Badge variant="warning">Pending review</Badge>
                ) : null}
              </div>
              {attempt && result?.grade?.status === 'approved' && result.grade.feedback ? (
                <p className="mt-2 text-xs text-muted">{result.grade.feedback}</p>
              ) : null}
            </Card>
          );
        })}
      </div>

      {canAttempt && questions.length > 0 ? (
        <Button className="mt-6" loading={submitAttempt.isPending} onClick={requestSubmit}>
          Submit quiz
        </Button>
      ) : null}

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Submit this quiz?"
        description={
          answeredCount < questions.length
            ? `You've answered ${answeredCount} of ${questions.length} questions. Unanswered ones will be scored as incorrect, and you can't change your answers after submitting.`
            : "You can't change your answers after submitting."
        }
        confirmLabel="Submit quiz"
        loading={submitAttempt.isPending}
        onConfirm={onSubmit}
      />
    </AppShell>
  );
};
