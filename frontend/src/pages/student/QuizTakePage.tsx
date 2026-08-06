import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';

import { useQuiz, useMyAttempt, useSubmitAttempt } from '../../features/quizzes/useQuizzes.js';
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
import { cn } from '../../lib/cn.js';

export const QuizTakePage = () => {
  const { courseId = '', quizId = '' } = useParams();
  const { data: quiz, isLoading } = useQuiz(courseId, quizId);
  const { data: attempt } = useMyAttempt(courseId, quizId);
  const submitAttempt = useSubmitAttempt(courseId, quizId);

  const [answers, setAnswers] = useState<Record<string, number | string>>({});

  const questions = quiz?.questions ?? [];
  const resultsByQuestion = new Map((attempt?.results ?? []).map((r) => [r.questionId, r]));

  const onSubmit = async () => {
    const responses = Object.entries(answers).map(([questionId, answer]) => ({ questionId, answer }));
    if (responses.length === 0) {
      toast.error('Answer at least one question first');
      return;
    }
    try {
      await submitAttempt.mutateAsync({ responses });
      toast.success('Quiz submitted');
    } catch (caught) {
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
              <Badge variant="success">
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
                          disabled={Boolean(attempt)}
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
                <p className="rounded-control border border-border bg-surface-hover/40 px-3 py-2 text-sm text-fg">
                  {String(result?.answer ?? '—')}
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
                  <Badge variant="success">
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

      {!attempt && questions.length > 0 ? (
        <Button className="mt-6" loading={submitAttempt.isPending} onClick={onSubmit}>
          Submit quiz
        </Button>
      ) : null}
    </AppShell>
  );
};
