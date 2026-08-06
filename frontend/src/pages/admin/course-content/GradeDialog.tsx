import { useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { Sparkles } from 'lucide-react';

import type { Assignment, Submission } from '../../../features/assignments/assignments.schema.js';
import {
  useGradeSubmission,
  useEditGrade,
} from '../../../features/assignments/useAssignments.js';
import { ApiError } from '../../../lib/apiError.js';
import { toast } from '../../../lib/toast.js';
import { Dialog } from '../../../components/ui/Dialog.js';
import { Button } from '../../../components/ui/Button.js';
import { Badge } from '../../../components/ui/Badge.js';
import { Input } from '../../../components/ui/Input.js';
import { Textarea } from '../../../components/ui/Textarea.js';
import { Alert } from '../../../components/ui/Alert.js';
import { EmptyState } from '../../../components/ui/EmptyState.js';

interface GradeDialogProps {
  courseId: string;
  assignmentId: string;
  assignment: Assignment;
  submission: Submission | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface GradeFormInput {
  criterionFeedback: { criterion: string; maxPoints: number; awardedPoints: number; feedback: string }[];
  overallFeedback: string;
}

export const GradeDialog = ({
  courseId,
  assignmentId,
  assignment,
  submission,
  open,
  onOpenChange,
}: GradeDialogProps) => {
  const gradeSubmission = useGradeSubmission(courseId, assignmentId);
  const editGrade = useEditGrade(courseId, assignmentId);

  const { register: field, control, handleSubmit, reset: resetForm } = useForm<GradeFormInput>({
    defaultValues: { criterionFeedback: [], overallFeedback: '' },
  });
  const { fields } = useFieldArray({ control, name: 'criterionFeedback' });

  useEffect(() => {
    if (!open || !submission?.grade) return;
    resetForm({
      criterionFeedback: submission.grade.criterionFeedback,
      overallFeedback: submission.grade.overallFeedback ?? '',
    });
  }, [open, submission?.grade, resetForm]);

  const closeDialog = () => {
    onOpenChange(false);
    gradeSubmission.reset();
    editGrade.reset();
  };

  const runAiGrading = async () => {
    if (!submission) return;
    try {
      await gradeSubmission.mutateAsync(submission.id);
      toast.success('Draft grade generated');
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : 'Grading failed');
    }
  };

  const save = (status?: 'draft' | 'approved') =>
    handleSubmit(async (values) => {
      if (!submission) return;
      await editGrade.mutateAsync({
        submissionId: submission.id,
        input: { ...values, status },
      });
      toast.success(status === 'approved' ? 'Grade approved' : 'Grade saved');
      if (status === 'approved') closeDialog();
    });

  const totalAwarded = fields.reduce((sum, f) => sum + f.awardedPoints, 0);
  const totalMax = assignment.rubric.reduce((sum, c) => sum + c.maxPoints, 0);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => (next ? onOpenChange(true) : closeDialog())}
      title={submission?.student?.name ?? 'Submission'}
      description={submission?.isLate ? 'Submitted late' : undefined}
    >
      {!submission ? null : (
        <div className="flex max-h-[70vh] flex-col gap-4 overflow-y-auto pr-1">
          {(gradeSubmission.error ?? editGrade.error) instanceof ApiError ? (
            <Alert>{((gradeSubmission.error ?? editGrade.error) as ApiError).message}</Alert>
          ) : null}

          <div className="rounded-control border border-border bg-surface-hover/40 p-3">
            {submission.content ? (
              <p className="whitespace-pre-wrap text-sm text-fg">{submission.content}</p>
            ) : (
              <p className="text-sm text-subtle">No text content.</p>
            )}
            {submission.fileUrl ? (
              <a
                href={submission.fileUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-block text-sm text-primary hover:underline"
              >
                {submission.fileOriginalName ?? 'Attached file'}
              </a>
            ) : null}
          </div>

          {!submission.grade ? (
            <EmptyState
              icon={Sparkles}
              title="Not graded yet"
              description="Run AI grading to get a draft score and feedback against the rubric — you'll review and approve before the student sees it."
              action={
                <Button loading={gradeSubmission.isPending} onClick={runAiGrading}>
                  <Sparkles className="size-4" aria-hidden />
                  Run AI grading
                </Button>
              }
            />
          ) : (
            <form className="flex flex-col gap-4" noValidate>
              <div className="flex items-center justify-between">
                <Badge variant={submission.grade.status === 'approved' ? 'success' : 'warning'}>
                  {submission.grade.status === 'approved' ? 'Approved' : 'Draft — pending review'}
                </Badge>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  loading={gradeSubmission.isPending}
                  onClick={runAiGrading}
                >
                  <Sparkles className="size-4" aria-hidden />
                  Re-grade with AI
                </Button>
              </div>

              <div className="flex flex-col gap-3">
                {fields.map((row, index) => (
                  <div key={row.id} className="rounded-control border border-border p-3">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <span className="text-sm font-medium text-fg">{row.criterion}</span>
                      <div className="flex items-center gap-1.5 text-sm text-muted">
                        <Input
                          type="number"
                          className="w-16"
                          {...field(`criterionFeedback.${index}.awardedPoints` as const, {
                            valueAsNumber: true,
                          })}
                        />
                        <span>/ {row.maxPoints}</span>
                      </div>
                    </div>
                    <Textarea
                      rows={2}
                      {...field(`criterionFeedback.${index}.feedback` as const)}
                    />
                  </div>
                ))}
              </div>

              <div>
                <label htmlFor="overallFeedback" className="text-sm font-medium text-fg">
                  Overall feedback
                </label>
                <Textarea id="overallFeedback" rows={2} className="mt-1.5" {...field('overallFeedback')} />
              </div>

              <p className="text-sm text-muted">
                Total: <span className="font-medium text-fg">{totalAwarded}</span> / {totalMax}
              </p>

              <div className="mt-1 flex justify-end gap-3">
                <Button type="button" variant="secondary" onClick={closeDialog}>
                  Close
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  loading={editGrade.isPending}
                  onClick={save('draft')}
                >
                  Save changes
                </Button>
                <Button type="button" loading={editGrade.isPending} onClick={save('approved')}>
                  Approve
                </Button>
              </div>
            </form>
          )}
        </div>
      )}
    </Dialog>
  );
};
