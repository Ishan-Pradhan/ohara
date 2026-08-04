import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { BookOpen, Layers, MoreVertical, Pencil, Plus, Trash2, Users } from 'lucide-react';

import {
  createCourseSchema,
  type Course,
  type CreateCourseInput,
} from '../../features/institution/institution.schema.js';
import {
  useClasses,
  useCourses,
  useCreateCourse,
  useDeleteCourse,
  useUpdateCourse,
} from '../../features/institution/useInstitution.js';
import { ApiError } from '../../lib/apiError.js';
import { toast } from '../../lib/toast.js';
import { AppShell } from '../../components/layout/AppShell.js';
import { PageHeader } from '../../components/layout/PageHeader.js';
import { Button } from '../../components/ui/Button.js';
import { Field } from '../../components/ui/Field.js';
import { Input } from '../../components/ui/Input.js';
import { Select } from '../../components/ui/Select.js';
import { Skeleton } from '../../components/ui/Skeleton.js';
import { EmptyState } from '../../components/ui/EmptyState.js';
import { Dialog, ConfirmDialog } from '../../components/ui/Dialog.js';
import { Alert } from '../../components/ui/Alert.js';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../../components/ui/DropdownMenu.js';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeadCell,
  TableRow,
} from '../../components/ui/Table.js';
import { CourseTeachersDialog } from './CourseTeachersDialog.js';

export const CoursesPage = () => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Course | null>(null);
  const [deleting, setDeleting] = useState<Course | null>(null);
  const [teachersFor, setTeachersFor] = useState<{ id: string; title: string } | null>(null);
  const { data: courses, isLoading } = useCourses();
  const { data: classes } = useClasses();
  const createCourse = useCreateCourse();
  const updateCourse = useUpdateCourse();
  const deleteCourse = useDeleteCourse();

  const {
    register: field,
    handleSubmit,
    control,
    reset: resetForm,
    formState: { errors },
  } = useForm<CreateCourseInput>({ resolver: zodResolver(createCourseSchema) });

  const className = (id: string) => classes?.find((c) => c.id === id)?.name ?? '—';

  const openCreate = () => {
    setEditing(null);
    resetForm({ classId: undefined, title: '', code: '', description: '' });
    setDialogOpen(true);
  };

  const openEdit = (course: Course) => {
    setEditing(course);
    resetForm({
      classId: course.classId,
      title: course.title,
      code: course.code,
      description: course.description ?? '',
    });
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    resetForm();
    createCourse.reset();
    updateCourse.reset();
  };

  const onSubmit = handleSubmit(async (values) => {
    if (editing) {
      const updated = await updateCourse.mutateAsync({ id: editing.id, input: values });
      toast.success(`${updated.title} updated`);
    } else {
      const created = await createCourse.mutateAsync(values);
      toast.success(`${created.title} created`);
    }
    closeDialog();
  });

  const confirmDelete = async () => {
    if (!deleting) return;
    try {
      await deleteCourse.mutateAsync(deleting.id);
      toast.success(`${deleting.title} deleted`);
      setDeleting(null);
    } catch (caught) {
      if (caught instanceof ApiError) {
        toast.error(caught.message);
      }
    }
  };

  const error = editing ? updateCourse.error : createCourse.error;
  const isPending = editing ? updateCourse.isPending : createCourse.isPending;

  const classOptions = (classes ?? []).map((c) => ({ value: c.id, label: c.name }));

  return (
    <AppShell>
      <PageHeader
        title="Courses"
        description="A taught subject within a class — everything AI and assessment hangs off a course."
        actions={
          <Button onClick={openCreate} disabled={!classes?.length}>
            <Plus className="size-4" aria-hidden />
            New course
          </Button>
        }
      />

      {isLoading ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : !classes || classes.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="Create a class first"
          description="Courses belong to a class. Add a class before creating courses."
        />
      ) : !courses || courses.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="No courses yet"
          description="Create a course so it can be assigned to a teacher and taught."
          action={<Button onClick={openCreate}>Create a course</Button>}
        />
      ) : (
        <Table>
          <TableHead>
            <TableRow>
              <TableHeadCell>Title</TableHeadCell>
              <TableHeadCell>Code</TableHeadCell>
              <TableHeadCell>Class</TableHeadCell>
              <TableHeadCell />
              <TableHeadCell />
            </TableRow>
          </TableHead>
          <TableBody>
            {courses.map((course) => (
              <TableRow key={course.id}>
                <TableCell className="font-medium">{course.title}</TableCell>
                <TableCell className="text-muted">{course.code}</TableCell>
                <TableCell className="text-muted">{className(course.classId)}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Link
                      to={`/admin/courses/${course.id}`}
                      className="inline-flex items-center justify-center gap-2 rounded-control px-3 py-1.5 text-sm font-medium text-fg transition-colors hover:bg-surface-hover"
                    >
                      <Layers className="size-4" aria-hidden />
                      Content
                    </Link>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setTeachersFor({ id: course.id, title: course.title })}
                    >
                      <Users className="size-4" aria-hidden />
                      Teachers
                    </Button>
                  </div>
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger className="rounded-control p-1.5 text-subtle transition-colors hover:bg-surface-hover hover:text-fg">
                      <MoreVertical className="size-4" aria-hidden />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      <DropdownMenuItem onSelect={() => openEdit(course)}>
                        <Pencil className="size-4" aria-hidden />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => setDeleting(course)} destructive>
                        <Trash2 className="size-4" aria-hidden />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => (open ? setDialogOpen(true) : closeDialog())}
        title={editing ? 'Edit course' : 'New course'}
        description="Teachers can be assigned to this course afterwards."
      >
        <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
          {error instanceof ApiError ? <Alert>{error.message}</Alert> : null}

          <Field label="Class" htmlFor="classId" error={errors.classId?.message}>
            <Controller
              control={control}
              name="classId"
              render={({ field: selectField }) => (
                <Select
                  id="classId"
                  options={classOptions}
                  value={selectField.value}
                  onValueChange={selectField.onChange}
                  invalid={Boolean(errors.classId)}
                  placeholder="Select a class"
                />
              )}
            />
          </Field>

          <Field label="Title" htmlFor="title" error={errors.title?.message}>
            <Input id="title" placeholder="e.g. Physics" {...field('title')} />
          </Field>

          <Field label="Code" htmlFor="code" error={errors.code?.message} hint="Must be unique">
            <Input id="code" placeholder="e.g. PHYS-101" {...field('code')} />
          </Field>

          <Field
            label="Description"
            htmlFor="description"
            error={errors.description?.message}
            hint="Optional"
          >
            <Input id="description" {...field('description')} />
          </Field>

          <div className="mt-2 flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={closeDialog}>
              Cancel
            </Button>
            <Button type="submit" loading={isPending}>
              {editing ? 'Save changes' : 'Create course'}
            </Button>
          </div>
        </form>
      </Dialog>

      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Delete this course?"
        description={`${deleting?.title} will be permanently removed. This can't be undone, and fails if it has teachers or enrollments.`}
        confirmLabel="Delete"
        destructive
        loading={deleteCourse.isPending}
        onConfirm={confirmDelete}
      />

      {teachersFor ? (
        <CourseTeachersDialog
          courseId={teachersFor.id}
          courseTitle={teachersFor.title}
          open={Boolean(teachersFor)}
          onOpenChange={(open) => !open && setTeachersFor(null)}
        />
      ) : null}
    </AppShell>
  );
};
