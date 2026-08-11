import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ChevronLeft, HelpCircle, Pencil, Plus, Sparkles, Trash2, Users } from 'lucide-react';

import {
  useAttempts,
  useDeleteQuestion,
  useGradeAllShortAnswers,
  usePublishQuiz,
  useQuiz,
} from '../../../features/quizzes/useQuizzes.js';
import type { Question } from '../../../features/quizzes/quizzes.schema.js';
import { useCurrentUser } from '../../../features/auth/useAuth.js';
import { ApiError } from '../../../lib/apiError.js';
import { toast } from '../../../lib/toast.js';
import { AppShell } from '../../../components/layout/AppShell.js';
import { PageHeader } from '../../../components/layout/PageHeader.js';
import { Badge } from '../../../components/ui/Badge.js';
import { Button } from '../../../components/ui/Button.js';
import { Card } from '../../../components/ui/Card.js';
import { Switch } from '../../../components/ui/Switch.js';
import { Skeleton } from '../../../components/ui/Skeleton.js';
import { EmptyState } from '../../../components/ui/EmptyState.js';
import { ConfirmDialog } from '../../../components/ui/Dialog.js';
import { Table, TableHead, TableBody, TableRow, TableHeadCell, TableCell } from '../../../components/ui/Table.js';
import { QuestionDialog } from './QuestionDialog.js';
import { ShortAnswerReviewDialog } from './ShortAnswerReviewDialog.js';

export const QuizDetailPage = () => {
  const { courseId = '', quizId = '' } = useParams();
  const { data: currentUser } = useCurrentUser();
  const coursePath = currentUser?.role === 'teacher' ? `/teacher/courses/${courseId}/quizzes` : `/admin/courses/${courseId}`;
  const { data: quiz, isLoading } = useQuiz(courseId, quizId);
  const { data: attempts, isLoading: attemptsLoading } = useAttempts(courseId, quizId);
  const publishQuiz = usePublishQuiz(courseId);
  const deleteQuestion = useDeleteQuestion(courseId, quizId);
  const gradeAllShortAnswers = useGradeAllShortAnswers(courseId, quizId);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Question | null>(null);
  const [deleting, setDeleting] = useState<Question | null>(null);
  const [reviewingAttemptId, setReviewingAttemptId] = useState<string | null>(null);

  const onTogglePublish = async (checked: boolean) => {
    await publishQuiz.mutateAsync({ id: quizId, status: checked ? 'published' : 'draft' });
    toast.success(checked ? 'Quiz published' : 'Quiz unpublished');
  };

  const openCreate = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  const openEdit = (question: Question) => {
    setEditing(question);
    setDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    await deleteQuestion.mutateAsync(deleting.id);
    toast.success('Question deleted');
    setDeleting(null);
  };

  const onGradeAllShortAnswers = async () => {
    try {
      const result = await gradeAllShortAnswers.mutateAsync();
      toast.success(`Graded ${result.graded} of ${result.total}${result.failed ? ` (${result.failed} failed)` : ''}`);
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : 'Batch grading failed');
    }
  };

  const questions = quiz?.questions ?? [];
  const hasShortAnswer = questions.some((q) => q.type === 'short_answer');
  const reviewingAttempt = attempts?.find((a) => a.id === reviewingAttemptId) ?? null;
  const ungradedShortAnswerCount = (attempts ?? []).reduce(
    (sum, attempt) =>
      sum + attempt.results.filter((r) => r.type === 'short_answer' && r.grade?.status === 'ungraded').length,
    0,
  );

  return (
    <AppShell>
      <Link
        to={coursePath}
        className="mb-1 flex items-center gap-1 text-sm text-muted hover:text-fg"
      >
        <ChevronLeft className="size-3.5" aria-hidden />
        {currentUser?.role === 'teacher' ? 'Quizzes' : 'Course content'}
      </Link>

      {isLoading ? (
        <Skeleton className="h-10 w-64" />
      ) : (
        <PageHeader
          title={quiz?.title ?? 'Quiz'}
          description={`${questions.length} question${questions.length === 1 ? '' : 's'}`}
          actions={
            quiz ? (
              <div className="flex items-center gap-3">
                <Badge variant={quiz.status === 'published' ? 'success' : 'neutral'}>{quiz.status}</Badge>
                <Switch
                  checked={quiz.status === 'published'}
                  onCheckedChange={onTogglePublish}
                  disabled={publishQuiz.isPending}
                  id="publish-quiz-toggle"
                />
              </div>
            ) : undefined
          }
        />
      )}

      <div className="flex flex-col gap-10">
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-semibold text-fg">Questions</h2>
            <Button size="sm" onClick={openCreate}>
              <Plus className="size-4" aria-hidden />
              Add question
            </Button>
          </div>

          {questions.length === 0 ? (
            <EmptyState icon={HelpCircle} title="No questions yet" description="Add a question, or generate more from the Quizzes tab." />
          ) : (
            <div className="flex flex-col gap-2">
              {questions.map((question, index) => (
                <Card key={question.id} padding="sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-fg">
                        {index + 1}. {question.prompt}
                      </p>
                      {question.type === 'mcq' && question.options ? (
                        <ul className="mt-2 flex flex-col gap-1">
                          {question.options.map((option, optionIndex) => (
                            <li
                              key={optionIndex}
                              className={`text-sm ${optionIndex === question.correctIndex ? 'font-medium text-success' : 'text-muted'}`}
                            >
                              {optionIndex === question.correctIndex ? '✓ ' : '• '}
                              {option}
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Badge>{question.points} pt{question.points === 1 ? '' : 's'}</Badge>
                      <Badge variant={question.type === 'mcq' ? 'primary' : 'accent'}>
                        {question.type === 'mcq' ? 'MCQ' : 'Short answer'}
                      </Badge>
                      <Button size="sm" variant="ghost" aria-label="Edit question" onClick={() => openEdit(question)}>
                        <Pencil className="size-4" aria-hidden />
                      </Button>
                      <Button size="sm" variant="ghost" aria-label="Delete question" onClick={() => setDeleting(question)}>
                        <Trash2 className="size-4" aria-hidden />
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>

        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-semibold text-fg">Attempts</h2>
            {hasShortAnswer ? (
              <Button
                size="sm"
                variant="secondary"
                loading={gradeAllShortAnswers.isPending}
                disabled={ungradedShortAnswerCount === 0}
                onClick={() => void onGradeAllShortAnswers()}
              >
                <Sparkles className="size-4" aria-hidden />
                Grade all short answers ({ungradedShortAnswerCount} ungraded)
              </Button>
            ) : null}
          </div>
          {attemptsLoading ? (
            <Skeleton className="h-12 w-full" />
          ) : !attempts || attempts.length === 0 ? (
            <EmptyState icon={Users} title="No attempts yet" description="Nothing here until a student takes this quiz." />
          ) : (
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeadCell>Student</TableHeadCell>
                  <TableHeadCell>Score</TableHeadCell>
                  <TableHeadCell>Submitted</TableHeadCell>
                  {hasShortAnswer ? <TableHeadCell /> : null}
                </TableRow>
              </TableHead>
              <TableBody>
                {attempts.map((attempt) => (
                  <TableRow key={attempt.id}>
                    <TableCell>{attempt.student?.name ?? attempt.studentId}</TableCell>
                    <TableCell>
                      {attempt.score} / {attempt.maxScore}
                    </TableCell>
                    <TableCell>{new Date(attempt.submittedAt).toLocaleString()}</TableCell>
                    {hasShortAnswer ? (
                      <TableCell>
                        <Button size="sm" variant="secondary" onClick={() => setReviewingAttemptId(attempt.id)}>
                          Review
                        </Button>
                      </TableCell>
                    ) : null}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </div>

      <QuestionDialog
        courseId={courseId}
        quizId={quizId}
        question={editing}
        nextOrderIndex={questions.length}
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setEditing(null);
        }}
      />

      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Delete this question?"
        confirmLabel="Delete"
        destructive
        loading={deleteQuestion.isPending}
        onConfirm={confirmDelete}
      />

      <ShortAnswerReviewDialog
        courseId={courseId}
        quizId={quizId}
        questions={questions}
        attempt={reviewingAttempt}
        open={Boolean(reviewingAttemptId)}
        onOpenChange={(open) => !open && setReviewingAttemptId(null)}
      />
    </AppShell>
  );
};
