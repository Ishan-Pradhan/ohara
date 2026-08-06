import { useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { Plus, Trash2 } from 'lucide-react';

import type { Question } from '../../../features/quizzes/quizzes.schema.js';
import { useCreateQuestion, useUpdateQuestion } from '../../../features/quizzes/useQuizzes.js';
import { ApiError } from '../../../lib/apiError.js';
import { toast } from '../../../lib/toast.js';
import { Dialog } from '../../../components/ui/Dialog.js';
import { Button } from '../../../components/ui/Button.js';
import { Field } from '../../../components/ui/Field.js';
import { Input } from '../../../components/ui/Input.js';
import { Textarea } from '../../../components/ui/Textarea.js';
import { Select } from '../../../components/ui/Select.js';
import { Checkbox } from '../../../components/ui/Checkbox.js';
import { Alert } from '../../../components/ui/Alert.js';

interface QuestionDialogProps {
  courseId: string;
  quizId: string;
  question: Question | null;
  nextOrderIndex: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface QuestionFormInput {
  type: 'mcq' | 'short_answer';
  prompt: string;
  options: { value: string }[];
  correctIndex: number;
  points: number;
}

const emptyForm: QuestionFormInput = {
  type: 'mcq',
  prompt: '',
  options: [{ value: '' }, { value: '' }],
  correctIndex: 0,
  points: 1,
};

export const QuestionDialog = ({
  courseId,
  quizId,
  question,
  nextOrderIndex,
  open,
  onOpenChange,
}: QuestionDialogProps) => {
  const createQuestion = useCreateQuestion(courseId, quizId);
  const updateQuestion = useUpdateQuestion(courseId, quizId);

  const {
    register: field,
    control,
    handleSubmit,
    reset: resetForm,
    setValue,
    watch,
    formState: { errors },
  } = useForm<QuestionFormInput>({ defaultValues: emptyForm });
  const { fields, append, remove } = useFieldArray({ control, name: 'options' });
  const type = watch('type');
  const correctIndex = watch('correctIndex');

  useEffect(() => {
    if (!open) return;
    if (question) {
      resetForm({
        type: question.type,
        prompt: question.prompt,
        options: (question.options ?? ['', '']).map((v) => ({ value: v })),
        correctIndex: question.correctIndex ?? 0,
        points: question.points,
      });
    } else {
      resetForm(emptyForm);
    }
  }, [open, question, resetForm]);

  const closeDialog = () => {
    onOpenChange(false);
    createQuestion.reset();
    updateQuestion.reset();
  };

  const onSubmit = handleSubmit(async (values) => {
    if (question) {
      const input =
        values.type === 'mcq'
          ? {
              prompt: values.prompt,
              options: values.options.map((o) => o.value),
              correctIndex: values.correctIndex,
              points: values.points,
            }
          : { prompt: values.prompt, points: values.points };
      await updateQuestion.mutateAsync({ id: question.id, input });
      toast.success('Question updated');
    } else {
      const input =
        values.type === 'mcq'
          ? {
              type: 'mcq' as const,
              prompt: values.prompt,
              options: values.options.map((o) => o.value),
              correctIndex: values.correctIndex,
              points: values.points,
              orderIndex: nextOrderIndex,
            }
          : {
              type: 'short_answer' as const,
              prompt: values.prompt,
              points: values.points,
              orderIndex: nextOrderIndex,
            };
      await createQuestion.mutateAsync(input);
      toast.success('Question added');
    }
    closeDialog();
  });

  const error = question ? updateQuestion.error : createQuestion.error;
  const isPending = question ? updateQuestion.isPending : createQuestion.isPending;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => (next ? onOpenChange(true) : closeDialog())}
      title={question ? 'Edit question' : 'New question'}
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        {error instanceof ApiError ? <Alert>{error.message}</Alert> : null}

        <Field label="Type" htmlFor="type">
          <Select
            id="type"
            value={type}
            onValueChange={(value) => setValue('type', value as 'mcq' | 'short_answer')}
            options={[
              { value: 'mcq', label: 'Multiple choice', disabled: Boolean(question) },
              { value: 'short_answer', label: 'Short answer', disabled: Boolean(question) },
            ]}
          />
        </Field>

        <Field label="Prompt" htmlFor="prompt" error={errors.prompt?.message}>
          <Textarea id="prompt" rows={2} {...field('prompt', { required: 'Prompt is required' })} />
        </Field>

        {type === 'mcq' ? (
          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium text-fg">Options — select the correct one</span>
            {fields.map((row, index) => (
              <div key={row.id} className="flex items-center gap-2">
                <Checkbox checked={correctIndex === index} onCheckedChange={() => setValue('correctIndex', index)} />
                <Input className="flex-1" {...field(`options.${index}.value` as const, { required: true })} />
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  aria-label="Remove option"
                  disabled={fields.length === 2}
                  onClick={() => remove(index)}
                >
                  <Trash2 className="size-4" aria-hidden />
                </Button>
              </div>
            ))}
            {fields.length < 6 ? (
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="self-start"
                onClick={() => append({ value: '' })}
              >
                <Plus className="size-4" aria-hidden />
                Add option
              </Button>
            ) : null}
          </div>
        ) : null}

        <Field label="Points" htmlFor="points" error={errors.points?.message}>
          <Input
            id="points"
            type="number"
            min={1}
            {...field('points', { valueAsNumber: true, required: true })}
          />
        </Field>

        <div className="mt-2 flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={closeDialog}>
            Cancel
          </Button>
          <Button type="submit" loading={isPending}>
            {question ? 'Save changes' : 'Add question'}
          </Button>
        </div>
      </form>
    </Dialog>
  );
};
