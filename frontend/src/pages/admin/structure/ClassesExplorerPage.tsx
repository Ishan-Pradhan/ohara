import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  ArrowRight,
  ChevronRight,
  Layers,
  MoreVertical,
  Pencil,
  Plus,
  Trash2,
  Users,
} from 'lucide-react';

import {
  createBatchSchema,
  createClassSchema,
  type Batch,
  type Class,
} from '../../../features/institution/institution.schema.js';
import {
  useAcademicYears,
  useBatches,
  useClasses,
  useCourses,
  useCreateBatch,
  useCreateClass,
  useDeleteBatch,
  useDeleteClass,
  usePrograms,
  useSections,
  useUpdateBatch,
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
import { Select } from '../../../components/ui/Select.js';
import { Skeleton } from '../../../components/ui/Skeleton.js';
import { EmptyState } from '../../../components/ui/EmptyState.js';
import { Dialog, ConfirmDialog } from '../../../components/ui/Dialog.js';
import { BlockersList } from '../../../components/ui/BlockersList.js';
import { Alert } from '../../../components/ui/Alert.js';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../../../components/ui/DropdownMenu.js';

const classFormSchema = createClassSchema.omit({ programId: true });
const batchFormSchema = createBatchSchema.omit({ programId: true });

export const ClassesExplorerPage = () => {
  const { programId = '' } = useParams();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Class | null>(null);
  const [deleting, setDeleting] = useState<Class | null>(null);
  const [deleteError, setDeleteError] = useState<ApiError | null>(null);

  const [batchDialogOpen, setBatchDialogOpen] = useState(false);
  const [editingBatch, setEditingBatch] = useState<Batch | null>(null);
  const [deletingBatch, setDeletingBatch] = useState<Batch | null>(null);

  const { data: programs, isLoading: programsLoading } = usePrograms();
  const { data: classes, isLoading: classesLoading } = useClasses();
  const { data: sections } = useSections();
  const { data: courses } = useCourses();
  const { data: years } = useAcademicYears();
  const createClass = useCreateClass();
  const updateClass = useUpdateClass();
  const deleteClass = useDeleteClass();

  const { data: batches, isLoading: batchesLoading } = useBatches(programId);
  const createBatch = useCreateBatch();
  const updateBatch = useUpdateBatch();
  const deleteBatch = useDeleteBatch();

  const program = programs?.find((p) => p.id === programId);
  const programClasses = (classes ?? []).filter((c) => c.programId === programId);
  const programBatches = batches ?? [];

  const {
    register: field,
    handleSubmit,
    reset: resetForm,
    formState: { errors },
  } = useForm<{ name: string; orderIndex: number }>({
    resolver: zodResolver(classFormSchema),
  });

  const {
    register: batchField,
    handleSubmit: handleBatchSubmit,
    control: batchControl,
    reset: resetBatchForm,
    formState: { errors: batchErrors },
  } = useForm<{ name: string; startAcademicYearId: string }>({
    resolver: zodResolver(batchFormSchema),
  });

  const currentYearId = years?.find((y) => y.isCurrent)?.id;
  const sectionCount = (classId: string) =>
    sections?.filter((s) => s.classId === classId && s.academicYearId === currentYearId).length ??
    0;
  const courseCount = (classId: string) =>
    courses?.filter((c) => c.classId === classId).length ?? 0;

  const openCreate = () => {
    setEditing(null);
    const nextOrderIndex = Math.max(-1, ...programClasses.map((c) => c.orderIndex)) + 1;
    resetForm({ name: '', orderIndex: nextOrderIndex });
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
    setDeleteError(null);
    try {
      await deleteClass.mutateAsync(deleting.id);
      toast.success(`${deleting.name} deleted`);
      setDeleting(null);
    } catch (caught) {
      if (caught instanceof ApiError) {
        setDeleteError(caught);
      }
    }
  };

  const error = editing ? updateClass.error : createClass.error;
  const isPending = editing ? updateClass.isPending : createClass.isPending;
  const isLoading = programsLoading || classesLoading;

  const yearOptions = (years ?? []).map((y) => ({
    value: y.id,
    label: `${y.name} (${y.term === 'odd' ? 'Odd semester' : y.term === 'even' ? 'Even semester' : 'Annual'})`,
  }));
  const yearName = (yearId: string) => years?.find((y) => y.id === yearId)?.name ?? '…';

  const openCreateBatch = () => {
    setEditingBatch(null);
    resetBatchForm({ name: '', startAcademicYearId: '' });
    setBatchDialogOpen(true);
  };

  const openEditBatch = (batch: Batch) => {
    setEditingBatch(batch);
    resetBatchForm({ name: batch.name, startAcademicYearId: batch.startAcademicYearId });
    setBatchDialogOpen(true);
  };

  const closeBatchDialog = () => {
    setBatchDialogOpen(false);
    resetBatchForm();
    createBatch.reset();
    updateBatch.reset();
  };

  const onSubmitBatch = handleBatchSubmit(async (values) => {
    if (editingBatch) {
      const updated = await updateBatch.mutateAsync({
        id: editingBatch.id,
        input: { name: values.name },
      });
      toast.success(`${updated.name} updated`);
    } else {
      const created = await createBatch.mutateAsync({ ...values, programId });
      toast.success(`${created.name} created`);
    }
    closeBatchDialog();
  });

  const confirmDeleteBatch = async () => {
    if (!deletingBatch) return;
    setDeleteError(null);
    try {
      await deleteBatch.mutateAsync(deletingBatch.id);
      toast.success(`${deletingBatch.name} deleted`);
      setDeletingBatch(null);
    } catch (caught) {
      if (caught instanceof ApiError) {
        setDeleteError(caught);
      }
    }
  };

  const batchError = editingBatch ? updateBatch.error : createBatch.error;
  const isBatchPending = editingBatch ? updateBatch.isPending : createBatch.isPending;

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

      {program ? (
        <>
          <div className="mt-10 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-fg">Batches</h2>
              <p className="text-sm text-muted">
                Admission cohorts within this program, e.g. Batch 2028, anchored to a starting
                academic year.
              </p>
            </div>
            <Button onClick={openCreateBatch}>
              <Plus className="size-4" aria-hidden />
              New batch
            </Button>
          </div>

          {batchesLoading ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          ) : programBatches.length === 0 ? (
            <EmptyState
              icon={Users}
              title={`Add a batch to ${program.name}`}
              description="e.g. Batch 2028. Batches group students admitted together, independent of class."
              action={<Button onClick={openCreateBatch}>Create a batch</Button>}
            />
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {programBatches.map((batch) => (
                <Card key={batch.id} padding="md" className="flex flex-col gap-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="truncate text-base font-semibold text-fg">{batch.name}</p>
                    <DropdownMenu>
                      <DropdownMenuTrigger className="shrink-0 rounded-control p-1.5 text-subtle transition-colors hover:bg-surface-hover hover:text-fg">
                        <MoreVertical className="size-4" aria-hidden />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <DropdownMenuItem onSelect={() => openEditBatch(batch)}>
                          <Pencil className="size-4" aria-hidden />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onSelect={() => setDeletingBatch(batch)}
                          destructive
                        >
                          <Trash2 className="size-4" aria-hidden />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  <p className="text-xs text-muted">
                    Starts {yearName(batch.startAcademicYearId)}
                  </p>
                </Card>
              ))}
            </div>
          )}
        </>
      ) : null}

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
        onOpenChange={(open) => {
          if (!open) {
            setDeleting(null);
            setDeleteError(null);
          }
        }}
        title="Delete this class?"
        description={`${deleting?.name} will be permanently removed. This can't be undone, and fails if it still has sections or courses.`}
        confirmLabel="Delete"
        destructive
        loading={deleteClass.isPending}
        onConfirm={confirmDelete}
      >
        {deleteError ? <BlockersList blockers={deleteError.blockers} /> : null}
      </ConfirmDialog>

      <Dialog
        open={batchDialogOpen}
        onOpenChange={(open) => (open ? setBatchDialogOpen(true) : closeBatchDialog())}
        title={editingBatch ? 'Edit batch' : 'New batch'}
        description={program ? `A batch within ${program.name}.` : undefined}
      >
        <form onSubmit={onSubmitBatch} className="flex flex-col gap-4" noValidate>
          {batchError instanceof ApiError ? <Alert>{batchError.message}</Alert> : null}

          <Field label="Name" htmlFor="batchName" error={batchErrors.name?.message}>
            <Input id="batchName" placeholder="e.g. Batch 2028" {...batchField('name')} />
          </Field>

          <Field
            label="Starting academic year"
            htmlFor="startAcademicYearId"
            error={batchErrors.startAcademicYearId?.message}
            hint={editingBatch ? "Can't be changed after the batch is created" : undefined}
          >
            <Controller
              control={batchControl}
              name="startAcademicYearId"
              render={({ field: selectField }) => (
                <Select
                  id="startAcademicYearId"
                  options={yearOptions}
                  value={selectField.value}
                  onValueChange={selectField.onChange}
                  invalid={Boolean(batchErrors.startAcademicYearId)}
                  placeholder="Select an academic year"
                />
              )}
            />
          </Field>

          <div className="mt-2 flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={closeBatchDialog}>
              Cancel
            </Button>
            <Button type="submit" loading={isBatchPending}>
              {editingBatch ? 'Save changes' : 'Create batch'}
            </Button>
          </div>
        </form>
      </Dialog>

      <ConfirmDialog
        open={Boolean(deletingBatch)}
        onOpenChange={(open) => {
          if (!open) {
            setDeletingBatch(null);
            setDeleteError(null);
          }
        }}
        title="Delete this batch?"
        description={`${deletingBatch?.name} will be permanently removed. This can't be undone, and fails if students are placed in it.`}
        confirmLabel="Delete"
        destructive
        loading={deleteBatch.isPending}
        onConfirm={confirmDeleteBatch}
      >
        {deleteError ? <BlockersList blockers={deleteError.blockers} /> : null}
      </ConfirmDialog>
    </AppShell>
  );
};
