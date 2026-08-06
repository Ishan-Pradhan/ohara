import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import { generateQuizSchema, type GenerateQuizInput } from '../../../features/quizzes/quizzes.schema.js';
import { useGenerateQuiz } from '../../../features/quizzes/useQuizzes.js';
import { useModules } from '../../../features/courseContent/useCourseContent.js';
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

interface GenerateQuizDialogProps {
  courseId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onGenerated: (quizId: string) => void;
}

export const GenerateQuizDialog = ({
  courseId,
  open,
  onOpenChange,
  onGenerated,
}: GenerateQuizDialogProps) => {
  const generateQuiz = useGenerateQuiz(courseId);
  const { data: modules } = useModules(courseId);
  const lessons = (modules ?? []).flatMap((m) => m.lessons.map((l) => ({ ...l, moduleTitle: m.title })));

  const [source, setSource] = useState<'lesson' | 'topic'>(lessons.length > 0 ? 'lesson' : 'topic');

  const {
    register: field,
    handleSubmit,
    reset: resetForm,
    setValue,
    watch,
    formState: { errors },
  } = useForm<GenerateQuizInput>({
    resolver: zodResolver(generateQuizSchema),
    defaultValues: { title: '', numQuestions: 5, types: ['mcq', 'short_answer'] },
  });
  const selectedTypes = watch('types');
  const lessonId = watch('lessonId');

  useEffect(() => {
    if (!open) return;
    resetForm({ title: '', numQuestions: 5, types: ['mcq', 'short_answer'] });
    setSource(lessons.length > 0 ? 'lesson' : 'topic');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, resetForm]);

  const closeDialog = () => {
    onOpenChange(false);
    generateQuiz.reset();
  };

  const toggleType = (type: 'mcq' | 'short_answer', checked: boolean) => {
    const current = selectedTypes ?? [];
    setValue('types', checked ? [...current, type] : current.filter((t) => t !== type));
  };

  const onSubmit = handleSubmit(async (values) => {
    const input =
      source === 'lesson'
        ? { ...values, lessonId: values.lessonId, topic: undefined }
        : { ...values, lessonId: undefined, topic: values.topic };
    const quiz = await generateQuiz.mutateAsync(input);
    toast.success(`Generated ${quiz.questions?.length ?? 0} questions`);
    closeDialog();
    onGenerated(quiz.id);
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => (next ? onOpenChange(true) : closeDialog())}
      title="Generate a quiz"
      description="The AI drafts questions from a lesson's content or a topic — review and edit before publishing."
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        {generateQuiz.error instanceof ApiError ? <Alert>{generateQuiz.error.message}</Alert> : null}

        <Field label="Title" htmlFor="title" error={errors.title?.message}>
          <Input id="title" {...field('title')} />
        </Field>

        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-fg">Source</span>
          <div className="inline-flex gap-1 rounded-control bg-surface-hover p-1">
            <button
              type="button"
              className={`flex-1 rounded-[0.4rem] px-3 py-1.5 text-sm font-medium transition-colors ${source === 'lesson' ? 'bg-surface text-fg shadow-sm' : 'text-muted'}`}
              onClick={() => setSource('lesson')}
              disabled={lessons.length === 0}
            >
              From a lesson
            </button>
            <button
              type="button"
              className={`flex-1 rounded-[0.4rem] px-3 py-1.5 text-sm font-medium transition-colors ${source === 'topic' ? 'bg-surface text-fg shadow-sm' : 'text-muted'}`}
              onClick={() => setSource('topic')}
            >
              Freeform topic
            </button>
          </div>
        </div>

        {source === 'lesson' ? (
          <Field label="Lesson" htmlFor="lessonId" error={errors.lessonId?.message}>
            <Select
              id="lessonId"
              value={lessonId}
              onValueChange={(value) => setValue('lessonId', value)}
              placeholder="Choose a lesson…"
              options={lessons.map((l) => ({ value: l.id, label: `${l.moduleTitle} — ${l.title}` }))}
            />
          </Field>
        ) : (
          <Field label="Topic" htmlFor="topic" error={errors.topic?.message} hint="What should the quiz cover?">
            <Textarea id="topic" rows={2} {...field('topic')} />
          </Field>
        )}

        <Field label="Number of questions" htmlFor="numQuestions" error={errors.numQuestions?.message}>
          <Input
            id="numQuestions"
            type="number"
            min={1}
            max={20}
            {...field('numQuestions', { valueAsNumber: true })}
          />
        </Field>

        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-fg">Question types</span>
          <label className="flex items-center gap-2 text-sm text-fg">
            <Checkbox
              checked={(selectedTypes ?? []).includes('mcq')}
              onCheckedChange={(checked) => toggleType('mcq', checked)}
            />
            Multiple choice
          </label>
          <label className="flex items-center gap-2 text-sm text-fg">
            <Checkbox
              checked={(selectedTypes ?? []).includes('short_answer')}
              onCheckedChange={(checked) => toggleType('short_answer', checked)}
            />
            Short answer
          </label>
          {errors.types?.message ? (
            <p role="alert" className="text-sm text-danger">
              {errors.types.message}
            </p>
          ) : null}
        </div>

        <div className="mt-2 flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={closeDialog}>
            Cancel
          </Button>
          <Button type="submit" loading={generateQuiz.isPending}>
            Generate
          </Button>
        </div>
      </form>
    </Dialog>
  );
};
