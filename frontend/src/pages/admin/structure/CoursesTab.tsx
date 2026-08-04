import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { BookOpen, MoreVertical, Pencil, Plus, Trash2, Users } from 'lucide-react';

import { createCourseSchema, type Course } from '../../../features/institution/institution.schema.js';
import {
  useCourses,
  useCreateCourse,
  useDeleteCourse,
  useUpdateCourse,
} from '../../../features/institution/useInstitution.js';
import { ApiError } from '../../../lib/apiError.js';
import { toast } from '../../../lib/toast.js';
import { Button } from '../../../components/ui/Button.js';
import { Field } from '../../../components/ui/Field.js';
import { Input } from '../../../components/ui/Input.js';
import { Skeleton } from '../../../components/ui/Skeleton.js';
import { EmptyState } from '../../../components/ui/EmptyState.js';
import { Dialog, ConfirmDialog } from '../../../components/ui/Dialog.js';
import { Alert } from '../../../components/ui/Alert.js';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../../../components/ui/DropdownMenu.js';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeadCell,
  TableRow,
} from '../../../components/ui/Table.js';
import { CourseTeachersDialog } from '../CourseTeachersDialog.js';

const courseFormSchema = createCourseSchema.omit({ classId: true });
type CourseFormInput = z.infer<typeof courseFormSchema>;

interface CoursesTabProps {
  classId: string;
}

export const CoursesTab = ({ classId }: CoursesTabProps) => {
  const { data: allCourses, isLoading } = useCourses();
  const createCourse = useCreateCourse();
  const updateCourse = useUpdateCourse();
  const deleteCourse = useDeleteCourse();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Course | null>(null);
  const [deleting, setDeleting] = useState<Course | null>(null);
  const [teachersFor, setTeachersFor] = useState<{ id: string; title: string } | null>(null);

  const courses = (allCourses ?? []).filter((c) => c.classId === classId);

  const {
    register: field,
    handleSubmit,
    reset: resetForm,
    formState: { errors },
  } = useForm<CourseFormInput>({ resolver: zodResolver(courseFormSchema) });

  const openCreate = () => {
    setEditing(null);
    resetForm({ title: '', code: '', description: '' });
    setDialogOpen(true);
  };

  const openEdit = (course: Course) => {
    setEditing(course);
    resetForm({ title: course.title, code: course.code, description: course.description ?? '' });
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    resetForm();
    createCourse.reset();
    updateCourse.reset();
  };

  const onSubmit = handleSubmit(async (values) => {
    const input = { ...values, classId };
    if (editing) {
      const updated = await updateCourse.mutateAsync({ id: editing.id, input });
      toast.success(`${updated.title} updated`);
    } else {
      const created = await createCourse.mutateAsync(input);
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

  if (isLoading) {
    return (
      <div className="flex flex-col gap-2">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Button size="sm" onClick={openCreate}>
          <Plus className="size-4" aria-hidden />
          New course
        </Button>
      </div>

      {courses.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="No courses yet in this class"
          description="Create a course so it can be assigned to a teacher and taught."
          action={<Button onClick={openCreate}>Create a course</Button>}
        />
      ) : (
        <Table>
          <TableHead>
            <TableRow>
              <TableHeadCell>Title</TableHeadCell>
              <TableHeadCell>Code</TableHeadCell>
              <TableHeadCell />
              <TableHeadCell />
              <TableHeadCell />
            </TableRow>
          </TableHead>
          <TableBody>
            {courses.map((course) => (
              <TableRow key={course.id}>
                <TableCell className="font-medium">{course.title}</TableCell>
                <TableCell className="text-muted">{course.code}</TableCell>
                <TableCell>
                  <Link
                    to={`/admin/courses/${course.id}`}
                    className="inline-flex items-center justify-center gap-2 rounded-control px-3 py-1.5 text-sm font-medium text-fg transition-colors hover:bg-surface-hover"
                  >
                    Content
                  </Link>
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setTeachersFor({ id: course.id, title: course.title })}
                  >
                    <Users className="size-4" aria-hidden />
                    Teachers
                  </Button>
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
    </div>
  );
};
