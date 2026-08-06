import { useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { Sparkles } from 'lucide-react';

import type { Question, QuizAttempt } from '../../../features/quizzes/quizzes.schema.js';
import {
  useGradeShortAnswer,
  useEditShortAnswerGrade,
} from '../../../features/quizzes/useQuizzes.js';
import { ApiError } from '../../../lib/apiError.js';
import { toast } from '../../../lib/toast.js';
import { Dialog } from '../../../components/ui/Dialog.js';
import { Button } from '../../../components/ui/Button.js';
import { Badge } from '../../../components/ui/Badge.js';
import { Input } from '../../../components/ui/Input.js';
import { Textarea } from '../../../components/ui/Textarea.js';
import { Alert } from '../../../components/ui/Alert.js';
import { EmptyState } from '../../../components/ui/EmptyState.js';

interface ShortAnswerReviewDialogProps {
  courseId: string;
  quizId: string;
  questions: Question[];
  attempt: QuizAttempt | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface FormRow {
  questionId: string;
  awardedPoints: number;
  feedback: string;
}

export const ShortAnswerReviewDialog = ({
  courseId,
  quizId,
  questions,
  attempt,
  open,
  onOpenChange,
}: ShortAnswerReviewDialogProps) => {
  const gradeShortAnswer = useGradeShortAnswer(courseId, quizId);
  const editGrade = useEditShortAnswerGrade(courseId, quizId);

  const { register: field, control, handleSubmit, reset: resetForm } = useForm<{ rows: FormRow[] }>({
    defaultValues: { rows: [] },
  });
  const { fields } = useFieldArray({ control, name: 'rows' });

  const shortAnswerResults = (attempt?.results ?? []).filter((r) => r.type === 'short_answer');

  useEffect(() => {
    if (!open) return;
    resetForm({
      rows: shortAnswerResults
        .filter((r) => r.grade && r.grade.awardedPoints !== null)
        .map((r) => ({
          questionId: r.questionId,
          awardedPoints: r.grade!.awardedPoints!,
          feedback: r.grade!.feedback ?? '',
        })),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, attempt, resetForm]);

  const closeDialog = () => {
    onOpenChange(false);
    gradeShortAnswer.reset();
    editGrade.reset();
  };

  const runAiGrading = async (questionId: string) => {
    if (!attempt) return;
    try {
      await gradeShortAnswer.mutateAsync({ attemptId: attempt.id, questionId });
      toast.success('Draft grade generated');
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : 'Grading failed');
    }
  };

  const save = (questionId: string, status?: 'draft' | 'approved') =>
    handleSubmit(async (values) => {
      if (!attempt) return;
      const row = values.rows.find((r) => r.questionId === questionId);
      if (!row) return;
      await editGrade.mutateAsync({
        attemptId: attempt.id,
        questionId,
        input: { awardedPoints: row.awardedPoints, feedback: row.feedback, status },
      });
      toast.success(status === 'approved' ? 'Grade approved' : 'Grade saved');
    });

  const error = gradeShortAnswer.error ?? editGrade.error;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => (next ? onOpenChange(true) : closeDialog())}
      title={attempt?.student?.name ?? 'Short-answer review'}
      description="AI drafts a score and feedback per question — review, edit, and approve before the student sees it."
    >
      {!attempt ? null : (
        <div className="flex max-h-[70vh] flex-col gap-4 overflow-y-auto pr-1">
          {error instanceof ApiError ? <Alert>{error.message}</Alert> : null}

          {shortAnswerResults.length === 0 ? (
            <EmptyState icon={Sparkles} title="No short-answer questions" description="This quiz has nothing to review here." />
          ) : (
            shortAnswerResults.map((result) => {
              const question = questions.find((q) => q.id === result.questionId);
              const rowIndex = fields.findIndex((f) => f.questionId === result.questionId);
              const hasGrade = rowIndex >= 0;

              return (
                <div key={result.questionId} className="rounded-control border border-border p-3">
                  <p className="text-sm font-medium text-fg">{question?.prompt}</p>
                  <p className="mt-1 whitespace-pre-wrap rounded-control bg-surface-hover/40 px-2.5 py-2 text-sm text-fg">
                    {String(result.answer) || '(no answer given)'}
                  </p>

                  {!result.grade || result.grade.status === 'ungraded' ? (
                    <div className="mt-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        loading={gradeShortAnswer.isPending}
                        onClick={() => void runAiGrading(result.questionId)}
                      >
                        <Sparkles className="size-4" aria-hidden />
                        Run AI grading
                      </Button>
                    </div>
                  ) : hasGrade ? (
                    <form className="mt-2 flex flex-col gap-2">
                      <div className="flex items-center justify-between gap-2">
                        <Badge variant={result.grade.status === 'approved' ? 'success' : 'warning'}>
                          {result.grade.status === 'approved' ? 'Approved' : 'Draft — pending review'}
                        </Badge>
                        <div className="flex items-center gap-1.5 text-sm text-muted">
                          <Input
                            type="number"
                            className="w-16"
                            {...field(`rows.${rowIndex}.awardedPoints` as const, { valueAsNumber: true })}
                          />
                          <span>/ {question?.points ?? result.grade.maxPoints}</span>
                        </div>
                      </div>
                      <Textarea rows={2} {...field(`rows.${rowIndex}.feedback` as const)} />
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          loading={gradeShortAnswer.isPending}
                          onClick={() => void runAiGrading(result.questionId)}
                        >
                          <Sparkles className="size-4" aria-hidden />
                          Re-grade
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          loading={editGrade.isPending}
                          onClick={save(result.questionId, 'draft')}
                        >
                          Save
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          loading={editGrade.isPending}
                          onClick={save(result.questionId, 'approved')}
                        >
                          Approve
                        </Button>
                      </div>
                    </form>
                  ) : null}
                </div>
              );
            })
          )}

          <div className="mt-2 flex justify-end">
            <Button type="button" variant="secondary" onClick={closeDialog}>
              Close
            </Button>
          </div>
        </div>
      )}
    </Dialog>
  );
};
