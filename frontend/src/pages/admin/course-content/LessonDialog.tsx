import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import type { Lesson } from '../../../features/courseContent/courseContent.schema.js';
import {
  useCreateLesson,
  useUpdateLesson,
} from '../../../features/courseContent/useCourseContent.js';
import { ApiError } from '../../../lib/apiError.js';
import { toast } from '../../../lib/toast.js';
import { Dialog } from '../../../components/ui/Dialog.js';
import { Button } from '../../../components/ui/Button.js';
import { Field } from '../../../components/ui/Field.js';
import { Input } from '../../../components/ui/Input.js';
import { Textarea } from '../../../components/ui/Textarea.js';
import { Alert } from '../../../components/ui/Alert.js';

interface LessonDialogProps {
  courseId: string;
  moduleId: string;
  lesson: Lesson | null;
  nextOrderIndex: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** keyTopics is a string[] on the wire; edited here as one comma-separated
 * field since there's no tag-input component yet — a dedicated form-shape
 * schema, not the API's CreateLessonInput, since the field type genuinely
 * differs (string here, string[] on the wire) and is split/joined only at
 * submit. */
const lessonFormSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  content: z.string().min(1, 'Content is required'),
  keyTopics: z.string().optional(),
  orderIndex: z.number().int('Must be a whole number'),
});

type LessonFormInput = z.infer<typeof lessonFormSchema>;

export const LessonDialog = ({
  courseId,
  moduleId,
  lesson,
  nextOrderIndex,
  open,
  onOpenChange,
}: LessonDialogProps) => {
  const createLesson = useCreateLesson(courseId);
  const updateLesson = useUpdateLesson(courseId);

  const {
    register: field,
    handleSubmit,
    reset: resetForm,
    formState: { errors },
  } = useForm<LessonFormInput>({
    resolver: zodResolver(lessonFormSchema),
  });

  useEffect(() => {
    if (!open) return;
    resetForm(
      lesson
        ? {
            title: lesson.title,
            content: lesson.content,
            keyTopics: lesson.keyTopics.join(', '),
            orderIndex: lesson.orderIndex,
          }
        : { title: '', content: '', keyTopics: '', orderIndex: nextOrderIndex },
    );
  }, [open, lesson, nextOrderIndex, resetForm]);

  const closeDialog = () => {
    onOpenChange(false);
    createLesson.reset();
    updateLesson.reset();
  };

  const onSubmit = handleSubmit(async (values) => {
    const keyTopics = (values.keyTopics ?? '')
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
    const input = { ...values, keyTopics };

    if (lesson) {
      await updateLesson.mutateAsync({ moduleId, lessonId: lesson.id, input });
      toast.success('Lesson updated');
    } else {
      await createLesson.mutateAsync({ moduleId, input });
      toast.success('Lesson created');
    }
    closeDialog();
  });

  const error = lesson ? updateLesson.error : createLesson.error;
  const isPending = lesson ? updateLesson.isPending : createLesson.isPending;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => (next ? onOpenChange(true) : closeDialog())}
      title={lesson ? 'Edit lesson' : 'New lesson'}
      description="Content is a short teaching writeup — key topics are what a student should take away."
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        {error instanceof ApiError ? <Alert>{error.message}</Alert> : null}

        <Field label="Title" htmlFor="title" error={errors.title?.message}>
          <Input id="title" {...field('title')} />
        </Field>

        <Field label="Content" htmlFor="content" error={errors.content?.message}>
          <Textarea id="content" rows={6} {...field('content')} />
        </Field>

        <Field
          label="Key topics"
          htmlFor="keyTopics"
          error={errors.keyTopics?.message}
          hint="Comma-separated"
        >
          <Input id="keyTopics" placeholder="e.g. chlorophyll, ATP" {...field('keyTopics')} />
        </Field>

        <Field
          label="Order"
          htmlFor="orderIndex"
          error={errors.orderIndex?.message}
        >
          <Input
            id="orderIndex"
            type="number"
            {...field('orderIndex', { valueAsNumber: true })}
          />
        </Field>

        <div className="mt-2 flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={closeDialog}>
            Cancel
          </Button>
          <Button type="submit" loading={isPending}>
            {lesson ? 'Save changes' : 'Create lesson'}
          </Button>
        </div>
      </form>
    </Dialog>
  );
};
