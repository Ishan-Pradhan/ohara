import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Layers, MoreVertical, Pencil, Plus, Trash2 } from 'lucide-react';

import {
  createClassSchema,
  type Class,
  type CreateClassInput,
} from '../../features/institution/institution.schema.js';
import {
  useClasses,
  useCreateClass,
  useDeleteClass,
  usePrograms,
  useUpdateClass,
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

export const ClassesPage = () => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Class | null>(null);
  const [deleting, setDeleting] = useState<Class | null>(null);
  const { data: classes, isLoading } = useClasses();
  const { data: programs } = usePrograms();
  const createClass = useCreateClass();
  const updateClass = useUpdateClass();
  const deleteClass = useDeleteClass();

  const {
    register: field,
    handleSubmit,
    control,
    reset: resetForm,
    formState: { errors },
  } = useForm<CreateClassInput>({ resolver: zodResolver(createClassSchema) });

  const programName = (id: string) => programs?.find((p) => p.id === id)?.name ?? '—';

  const openCreate = () => {
    setEditing(null);
    resetForm({ programId: undefined, name: '', orderIndex: undefined });
    setDialogOpen(true);
  };

  const openEdit = (cls: Class) => {
    setEditing(cls);
    resetForm({ programId: cls.programId, name: cls.name, orderIndex: cls.orderIndex });
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    resetForm();
    createClass.reset();
    updateClass.reset();
  };

  const onSubmit = handleSubmit(async (values) => {
    if (editing) {
      const updated = await updateClass.mutateAsync({ id: editing.id, input: values });
      toast.success(`${updated.name} updated`);
    } else {
      const created = await createClass.mutateAsync(values);
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

  const programOptions = (programs ?? []).map((p) => ({ value: p.id, label: p.name }));

  return (
    <AppShell>
      <PageHeader
        title="Classes"
        description="The promotable stage within a program — Grade 10, Year 2, Semester 1."
        actions={
          <Button onClick={openCreate} disabled={!programs?.length}>
            <Plus className="size-4" aria-hidden />
            New class
          </Button>
        }
      />

      {isLoading ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : !programs || programs.length === 0 ? (
        <EmptyState
          icon={Layers}
          title="Create a program first"
          description="Classes belong to a program. Add a program before creating classes."
        />
      ) : !classes || classes.length === 0 ? (
        <EmptyState
          icon={Layers}
          title="No classes yet"
          description="Create a class to start placing students and offering courses."
          action={<Button onClick={openCreate}>Create a class</Button>}
        />
      ) : (
        <Table>
          <TableHead>
            <TableRow>
              <TableHeadCell>Name</TableHeadCell>
              <TableHeadCell>Program</TableHeadCell>
              <TableHeadCell>Order</TableHeadCell>
              <TableHeadCell />
            </TableRow>
          </TableHead>
          <TableBody>
            {classes.map((cls) => (
              <TableRow key={cls.id}>
                <TableCell className="font-medium">{cls.name}</TableCell>
                <TableCell className="text-muted">{programName(cls.programId)}</TableCell>
                <TableCell className="text-muted">{cls.orderIndex}</TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger className="rounded-control p-1.5 text-subtle transition-colors hover:bg-surface-hover hover:text-fg">
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
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => (open ? setDialogOpen(true) : closeDialog())}
        title={editing ? 'Edit class' : 'New class'}
        description="A class is the promotable unit within a program."
      >
        <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
          {error instanceof ApiError ? <Alert>{error.message}</Alert> : null}

          <Field label="Program" htmlFor="programId" error={errors.programId?.message}>
            <Controller
              control={control}
              name="programId"
              render={({ field: selectField }) => (
                <Select
                  id="programId"
                  options={programOptions}
                  value={selectField.value}
                  onValueChange={selectField.onChange}
                  invalid={Boolean(errors.programId)}
                  placeholder="Select a program"
                />
              )}
            />
          </Field>

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
