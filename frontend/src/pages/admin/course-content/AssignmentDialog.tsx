import { useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Trash2 } from 'lucide-react';

import {
  createAssignmentSchema,
  type Assignment,
  type CreateAssignmentInput,
} from '../../../features/assignments/assignments.schema.js';
import {
  useCreateAssignment,
  useUpdateAssignment,
} from '../../../features/assignments/useAssignments.js';
import { ApiError } from '../../../lib/apiError.js';
import { toast } from '../../../lib/toast.js';
import { Dialog } from '../../../components/ui/Dialog.js';
import { Button } from '../../../components/ui/Button.js';
import { Field } from '../../../components/ui/Field.js';
import { Input } from '../../../components/ui/Input.js';
import { Textarea } from '../../../components/ui/Textarea.js';
import { Alert } from '../../../components/ui/Alert.js';

interface AssignmentDialogProps {
  courseId: string;
  assignment: Assignment | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** `datetime-local` inputs work in local time with no timezone suffix —
 * convert an ISO string to that shape for the field's default value. */
const toLocalInputValue = (iso: string): string => {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const emptyForm: CreateAssignmentInput = {
  title: '',
  prompt: '',
  rubric: [{ criterion: '', maxPoints: 10, description: '' }],
  dueAt: '',
};

export const AssignmentDialog = ({
  courseId,
  assignment,
  open,
  onOpenChange,
}: AssignmentDialogProps) => {
  const createAssignment = useCreateAssignment(courseId);
  const updateAssignment = useUpdateAssignment(courseId);

  const {
    register: field,
    control,
    handleSubmit,
    reset: resetForm,
    formState: { errors },
  } = useForm<CreateAssignmentInput>({
    resolver: zodResolver(createAssignmentSchema),
    defaultValues: emptyForm,
  });
  const { fields, append, remove } = useFieldArray({ control, name: 'rubric' });

  useEffect(() => {
    if (!open) return;
    resetForm(
      assignment
        ? {
            title: assignment.title,
            prompt: assignment.prompt,
            rubric: assignment.rubric,
            dueAt: toLocalInputValue(assignment.dueAt),
          }
        : emptyForm,
    );
  }, [open, assignment, resetForm]);

  const closeDialog = () => {
    onOpenChange(false);
    createAssignment.reset();
    updateAssignment.reset();
  };

  const onSubmit = handleSubmit(async (values) => {
    const input = { ...values, dueAt: new Date(values.dueAt).toISOString() };
    if (assignment) {
      await updateAssignment.mutateAsync({ id: assignment.id, input });
      toast.success('Assignment updated');
    } else {
      await createAssignment.mutateAsync(input);
      toast.success('Assignment created');
    }
    closeDialog();
  });

  const error = assignment ? updateAssignment.error : createAssignment.error;
  const isPending = assignment ? updateAssignment.isPending : createAssignment.isPending;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => (next ? onOpenChange(true) : closeDialog())}
      title={assignment ? 'Edit assignment' : 'New assignment'}
      description="The rubric drives both AI grading and what a student sees before submitting."
    >
      <form onSubmit={onSubmit} className="flex max-h-[70vh] flex-col gap-4 overflow-y-auto pr-1" noValidate>
        {error instanceof ApiError ? <Alert>{error.message}</Alert> : null}

        <Field label="Title" htmlFor="title" error={errors.title?.message}>
          <Input id="title" {...field('title')} />
        </Field>

        <Field label="Prompt" htmlFor="prompt" error={errors.prompt?.message}>
          <Textarea id="prompt" rows={4} {...field('prompt')} />
        </Field>

        <Field label="Due date" htmlFor="dueAt" error={errors.dueAt?.message}>
          <Input id="dueAt" type="datetime-local" {...field('dueAt')} />
        </Field>

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-fg">Rubric</span>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => append({ criterion: '', maxPoints: 10, description: '' })}
            >
              <Plus className="size-4" aria-hidden />
              Add criterion
            </Button>
          </div>
          {errors.rubric?.message ? (
            <p role="alert" className="text-sm text-danger">
              {errors.rubric.message}
            </p>
          ) : null}
          <div className="flex flex-col gap-3">
            {fields.map((row, index) => (
              <div key={row.id} className="flex items-start gap-2 rounded-control border border-border p-3">
                <div className="flex flex-1 flex-col gap-2">
                  <Input
                    placeholder="Criterion (e.g. Clarity)"
                    {...field(`rubric.${index}.criterion` as const)}
                  />
                  {errors.rubric?.[index]?.criterion ? (
                    <p role="alert" className="text-xs text-danger">
                      {errors.rubric[index]?.criterion?.message}
                    </p>
                  ) : null}
                  <Input
                    placeholder="Description (optional)"
                    {...field(`rubric.${index}.description` as const)}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <Input
                    type="number"
                    className="w-24"
                    placeholder="Points"
                    {...field(`rubric.${index}.maxPoints` as const, { valueAsNumber: true })}
                  />
                  {errors.rubric?.[index]?.maxPoints ? (
                    <p role="alert" className="text-xs text-danger">
                      {errors.rubric[index]?.maxPoints?.message}
                    </p>
                  ) : null}
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  aria-label="Remove criterion"
                  disabled={fields.length === 1}
                  onClick={() => remove(index)}
                >
                  <Trash2 className="size-4" aria-hidden />
                </Button>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-2 flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={closeDialog}>
            Cancel
          </Button>
          <Button type="submit" loading={isPending}>
            {assignment ? 'Save changes' : 'Create assignment'}
          </Button>
        </div>
      </form>
    </Dialog>
  );
};
