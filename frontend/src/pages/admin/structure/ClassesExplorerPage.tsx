import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowRight, ChevronRight, Layers, MoreVertical, Pencil, Plus, Trash2 } from 'lucide-react';

import {
  createClassSchema,
  type Class,
} from '../../../features/institution/institution.schema.js';
import {
  useClasses,
  useCourses,
  useCreateClass,
  useDeleteClass,
  usePrograms,
  useSections,
  useUpdateClass,
} from '../../../features/institution/useInstitution.js';
import { ApiError } from '../../../lib/apiError.js';
import { toast } from '../../../lib/toast.js';
import { AppShell } from '../../../components/layout/AppShell.js';
import { PageHeader } from '../../../components/layout/PageHeader.js';
import { Button } from '../../../components/ui/Button.js';
import { Card } from '../../../components/ui/Card.js';
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

const classFormSchema = createClassSchema.omit({ programId: true });

export const ClassesExplorerPage = () => {
  const { programId = '' } = useParams();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Class | null>(null);
  const [deleting, setDeleting] = useState<Class | null>(null);

  const { data: programs, isLoading: programsLoading } = usePrograms();
  const { data: classes, isLoading: classesLoading } = useClasses();
  const { data: sections } = useSections();
  const { data: courses } = useCourses();
  const createClass = useCreateClass();
  const updateClass = useUpdateClass();
  const deleteClass = useDeleteClass();

  const program = programs?.find((p) => p.id === programId);
  const programClasses = (classes ?? []).filter((c) => c.programId === programId);

  const {
    register: field,
    handleSubmit,
    reset: resetForm,
    formState: { errors },
  } = useForm<{ name: string; orderIndex: number }>({
    resolver: zodResolver(classFormSchema),
  });

  const sectionCount = (classId: string) =>
    sections?.filter((s) => s.classId === classId).length ?? 0;
  const courseCount = (classId: string) =>
    courses?.filter((c) => c.classId === classId).length ?? 0;

  const openCreate = () => {
    setEditing(null);
    resetForm({ name: '', orderIndex: programClasses.length });
    setDialogOpen(true);
  };

  const openEdit = (cls: Class) => {
    setEditing(cls);
    resetForm({ name: cls.name, orderIndex: cls.orderIndex });
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    resetForm();
    createClass.reset();
    updateClass.reset();
  };

  const onSubmit = handleSubmit(async (values) => {
    const input = { ...values, programId };
    if (editing) {
      const updated = await updateClass.mutateAsync({ id: editing.id, input });
      toast.success(`${updated.name} updated`);
    } else {
      const created = await createClass.mutateAsync(input);
      toast.success(`${created.name} created`);
    }
    closeDialog();
  });

  const confirmDelete = async () => {
    if (!deleting) return;
    try {
      await deleteClass.mutateAsync(deleting.id);
      toast.success(`${deleting.name} deleted`);
      setDeleting(null);
    } catch (caught) {
      if (caught instanceof ApiError) {
        toast.error(caught.message);
      }
    }
  };

  const error = editing ? updateClass.error : createClass.error;
  const isPending = editing ? updateClass.isPending : createClass.isPending;
  const isLoading = programsLoading || classesLoading;

  return (
    <AppShell>
      <div className="mb-1 flex items-center gap-1.5 text-sm text-muted">
        <Link to="/admin/structure" className="hover:text-fg hover:underline">
          Structure
        </Link>
        <ChevronRight className="size-3.5" aria-hidden />
        <span className="text-fg">{program?.name ?? '…'}</span>
      </div>

      <PageHeader
        title={program ? program.name : 'Classes'}
        description="Classes are the promotable stage within this program — e.g. Grade 10, Year 2."
        actions={
          program ? (
            <Button onClick={openCreate}>
              <Plus className="size-4" aria-hidden />
              New class
            </Button>
          ) : undefined
        }
      />

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      ) : !program ? (
        <EmptyState
          icon={Layers}
          title="Program not found"
          description="It may have been deleted."
          action={
            <Link
              to="/admin/structure"
              className="inline-flex items-center justify-center gap-2 rounded-control border border-border bg-surface px-4 py-2.5 text-sm font-medium text-fg transition-colors hover:bg-surface-hover hover:border-border-strong"
            >
              Back to Structure
            </Link>
          }
        />
      ) : programClasses.length === 0 ? (
        <EmptyState
          icon={Layers}
          title={`Add a class to ${program.name}`}
          description="e.g. Year 1. Classes are where sections and courses live."
          action={<Button onClick={openCreate}>Create a class</Button>}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {programClasses.map((cls) => (
            <Card key={cls.id} padding="md" className="flex flex-col gap-3">
              <div className="flex items-start justify-between gap-2">
                <p className="truncate text-base font-semibold text-fg">{cls.name}</p>
                <DropdownMenu>
                  <DropdownMenuTrigger className="shrink-0 rounded-control p-1.5 text-subtle transition-colors hover:bg-surface-hover hover:text-fg">
                    <MoreVertical className="size-4" aria-hidden />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem onSelect={() => openEdit(cls)}>
                      <Pencil className="size-4" aria-hidden />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => setDeleting(cls)} destructive>
                      <Trash2 className="size-4" aria-hidden />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              <p className="text-xs text-muted">
                {sectionCount(cls.id)} section{sectionCount(cls.id) === 1 ? '' : 's'} ·{' '}
                {courseCount(cls.id)} course{courseCount(cls.id) === 1 ? '' : 's'}
              </p>

              <Link
                to={`/admin/structure/${programId}/${cls.id}`}
                className="mt-auto flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
              >
                Open
                <ArrowRight className="size-3.5" aria-hidden />
              </Link>
            </Card>
          ))}
        </div>
      )}

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => (open ? setDialogOpen(true) : closeDialog())}
        title={editing ? 'Edit class' : 'New class'}
        description={program ? `A class within ${program.name}.` : undefined}
      >
        <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
          {error instanceof ApiError ? <Alert>{error.message}</Alert> : null}

          <Field label="Name" htmlFor="name" error={errors.name?.message}>
            <Input id="name" placeholder="e.g. Grade 10" {...field('name')} />
          </Field>

          <Field
            label="Order"
            htmlFor="orderIndex"
            error={errors.orderIndex?.message}
            hint="Position within the program — used for promotion order"
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
              {editing ? 'Save changes' : 'Create class'}
            </Button>
          </div>
        </form>
      </Dialog>

      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Delete this class?"
        description={`${deleting?.name} will be permanently removed. This can't be undone, and fails if it still has sections or courses.`}
        confirmLabel="Delete"
        destructive
        loading={deleteClass.isPending}
        onConfirm={confirmDelete}
      />
    </AppShell>
  );
};
