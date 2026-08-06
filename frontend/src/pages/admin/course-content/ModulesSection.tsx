import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from 'react-router-dom';
import { BookOpen, ChevronDown, ChevronRight, Layers, Pencil, Plus, Trash2 } from 'lucide-react';

import {
  createModuleSchema,
  type CreateModuleInput,
  type Lesson,
  type Module as CourseModule,
} from '../../../features/courseContent/courseContent.schema.js';
import {
  useCreateModule,
  useDeleteLesson,
  useDeleteModule,
  useModules,
  useUpdateModule,
} from '../../../features/courseContent/useCourseContent.js';
import { ApiError } from '../../../lib/apiError.js';
import { toast } from '../../../lib/toast.js';
import { Button } from '../../../components/ui/Button.js';
import { Badge } from '../../../components/ui/Badge.js';
import { Field } from '../../../components/ui/Field.js';
import { Input } from '../../../components/ui/Input.js';
import { Skeleton } from '../../../components/ui/Skeleton.js';
import { EmptyState } from '../../../components/ui/EmptyState.js';
import { Card } from '../../../components/ui/Card.js';
import { Dialog, ConfirmDialog } from '../../../components/ui/Dialog.js';
import { Alert } from '../../../components/ui/Alert.js';
import { LessonDialog } from './LessonDialog.js';

interface ModulesSectionProps {
  courseId: string;
}

export const ModulesSection = ({ courseId }: ModulesSectionProps) => {
  const { data: modules, isLoading } = useModules(courseId);
  const createModule = useCreateModule(courseId);
  const updateModule = useUpdateModule(courseId);
  const deleteModule = useDeleteModule(courseId);
  const deleteLesson = useDeleteLesson(courseId);

  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [moduleDialogOpen, setModuleDialogOpen] = useState(false);
  const [editingModule, setEditingModule] = useState<CourseModule | null>(null);
  const [deletingModule, setDeletingModule] = useState<CourseModule | null>(null);
  const [lessonDialog, setLessonDialog] = useState<{
    moduleId: string;
    lesson: Lesson | null;
  } | null>(null);
  const [deletingLesson, setDeletingLesson] = useState<{
    moduleId: string;
    lesson: Lesson;
  } | null>(null);

  const {
    register: field,
    handleSubmit,
    reset: resetForm,
    formState: { errors },
  } = useForm<CreateModuleInput>({ resolver: zodResolver(createModuleSchema) });

  const toggleExpanded = (moduleId: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(moduleId)) next.delete(moduleId);
      else next.add(moduleId);
      return next;
    });
  };

  const nextModuleOrderIndex = (modules?.length ?? 0);

  const openCreateModule = () => {
    setEditingModule(null);
    resetForm({ title: '', orderIndex: nextModuleOrderIndex });
    setModuleDialogOpen(true);
  };

  const openEditModule = (module: CourseModule) => {
    setEditingModule(module);
    resetForm({ title: module.title, orderIndex: module.orderIndex });
    setModuleDialogOpen(true);
  };

  const closeModuleDialog = () => {
    setModuleDialogOpen(false);
    resetForm();
    createModule.reset();
    updateModule.reset();
  };

  const onSubmitModule = handleSubmit(async (values) => {
    if (editingModule) {
      await updateModule.mutateAsync({ id: editingModule.id, input: values });
      toast.success('Module updated');
    } else {
      await createModule.mutateAsync(values);
      toast.success('Module created');
    }
    closeModuleDialog();
  });

  const confirmDeleteModule = async () => {
    if (!deletingModule) return;
    await deleteModule.mutateAsync(deletingModule.id);
    toast.success(`${deletingModule.title} deleted`);
    setDeletingModule(null);
  };

  const confirmDeleteLesson = async () => {
    if (!deletingLesson) return;
    await deleteLesson.mutateAsync({
      moduleId: deletingLesson.moduleId,
      lessonId: deletingLesson.lesson.id,
    });
    toast.success(`${deletingLesson.lesson.title} deleted`);
    setDeletingLesson(null);
  };

  const moduleError = editingModule ? updateModule.error : createModule.error;
  const moduleIsPending = editingModule ? updateModule.isPending : createModule.isPending;

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-base font-semibold text-fg">Structure</h2>
        <Button size="sm" onClick={openCreateModule}>
          <Plus className="size-4" aria-hidden />
          Add module
        </Button>
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </div>
      ) : !modules || modules.length === 0 ? (
        <EmptyState
          icon={Layers}
          title="No modules yet"
          description="Generate a structure from a ready document above, or add one by hand."
        />
      ) : (
        <div className="flex flex-col gap-2">
          {modules.map((module) => {
            const isOpen = expanded.has(module.id);
            return (
              <Card key={module.id} padding="none" className="overflow-hidden">
                <div className="flex items-center justify-between gap-3 px-4 py-3">
                  <button
                    type="button"
                    className="flex min-w-0 flex-1 items-center gap-2 text-left"
                    onClick={() => toggleExpanded(module.id)}
                  >
                    {isOpen ? (
                      <ChevronDown className="size-4 shrink-0 text-subtle" aria-hidden />
                    ) : (
                      <ChevronRight className="size-4 shrink-0 text-subtle" aria-hidden />
                    )}
                    <span className="truncate text-sm font-medium text-fg">{module.title}</span>
                    <Badge>{module.lessons.length} lesson{module.lessons.length === 1 ? '' : 's'}</Badge>
                  </button>
                  <div className="flex shrink-0 items-center gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      aria-label={`Edit ${module.title}`}
                      onClick={() => openEditModule(module)}
                    >
                      <Pencil className="size-4" aria-hidden />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      aria-label={`Delete ${module.title}`}
                      onClick={() => setDeletingModule(module)}
                    >
                      <Trash2 className="size-4" aria-hidden />
                    </Button>
                  </div>
                </div>

                {isOpen ? (
                  <div className="border-t border-border bg-surface-hover/40 px-4 py-3">
                    {module.lessons.length === 0 ? (
                      <p className="text-sm text-muted">No lessons in this module yet.</p>
                    ) : (
                      <div className="flex flex-col gap-2">
                        {module.lessons.map((lesson) => (
                          <div
                            key={lesson.id}
                            className="flex items-center justify-between gap-3 rounded-control border border-border bg-surface px-3 py-2"
                          >
                            <Link to={`/admin/courses/${courseId}/lessons/${lesson.id}`} className="min-w-0">
                              <p className="truncate text-sm font-medium text-fg hover:underline">{lesson.title}</p>
                              {lesson.keyTopics.length > 0 ? (
                                <div className="mt-1 flex flex-wrap gap-1">
                                  {lesson.keyTopics.map((topic) => (
                                    <Badge key={topic} variant="primary">
                                      {topic}
                                    </Badge>
                                  ))}
                                </div>
                              ) : null}
                            </Link>
                            <div className="flex shrink-0 items-center gap-1">
                              <Link
                                to={`/admin/courses/${courseId}/lessons/${lesson.id}`}
                                aria-label={`Read ${lesson.title}`}
                                className="inline-flex items-center justify-center rounded-control p-1.5 text-fg transition-colors hover:bg-surface-hover"
                              >
                                <BookOpen className="size-4" aria-hidden />
                              </Link>
                              <Button
                                size="sm"
                                variant="ghost"
                                aria-label={`Edit ${lesson.title}`}
                                onClick={() => setLessonDialog({ moduleId: module.id, lesson })}
                              >
                                <Pencil className="size-4" aria-hidden />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                aria-label={`Delete ${lesson.title}`}
                                onClick={() =>
                                  setDeletingLesson({ moduleId: module.id, lesson })
                                }
                              >
                                <Trash2 className="size-4" aria-hidden />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    <Button
                      size="sm"
                      variant="secondary"
                      className="mt-3"
                      onClick={() => setLessonDialog({ moduleId: module.id, lesson: null })}
                    >
                      <Plus className="size-4" aria-hidden />
                      Add lesson
                    </Button>
                  </div>
                ) : null}
              </Card>
            );
          })}
        </div>
      )}

      <Dialog
        open={moduleDialogOpen}
        onOpenChange={(open) => (open ? setModuleDialogOpen(true) : closeModuleDialog())}
        title={editingModule ? 'Edit module' : 'New module'}
      >
        <form onSubmit={onSubmitModule} className="flex flex-col gap-4" noValidate>
          {moduleError instanceof ApiError ? <Alert>{moduleError.message}</Alert> : null}

          <Field label="Title" htmlFor="title" error={errors.title?.message}>
            <Input id="title" {...field('title')} />
          </Field>

          <Field label="Order" htmlFor="orderIndex" error={errors.orderIndex?.message}>
            <Input id="orderIndex" type="number" {...field('orderIndex', { valueAsNumber: true })} />
          </Field>

          <div className="mt-2 flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={closeModuleDialog}>
              Cancel
            </Button>
            <Button type="submit" loading={moduleIsPending}>
              {editingModule ? 'Save changes' : 'Create module'}
            </Button>
          </div>
        </form>
      </Dialog>

      <ConfirmDialog
        open={Boolean(deletingModule)}
        onOpenChange={(open) => !open && setDeletingModule(null)}
        title="Delete this module?"
        description={`${deletingModule?.title} and all its lessons will be permanently removed.`}
        confirmLabel="Delete"
        destructive
        loading={deleteModule.isPending}
        onConfirm={confirmDeleteModule}
      />

      <ConfirmDialog
        open={Boolean(deletingLesson)}
        onOpenChange={(open) => !open && setDeletingLesson(null)}
        title="Delete this lesson?"
        description={`${deletingLesson?.lesson.title} will be permanently removed.`}
        confirmLabel="Delete"
        destructive
        loading={deleteLesson.isPending}
        onConfirm={confirmDeleteLesson}
      />

      {lessonDialog ? (
        <LessonDialog
          courseId={courseId}
          moduleId={lessonDialog.moduleId}
          lesson={lessonDialog.lesson}
          nextOrderIndex={
            modules?.find((m) => m.id === lessonDialog.moduleId)?.lessons.length ?? 0
          }
          open={Boolean(lessonDialog)}
          onOpenChange={(open) => !open && setLessonDialog(null)}
        />
      ) : null}
    </div>
  );
};
