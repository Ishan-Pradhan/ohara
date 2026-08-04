import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { MoreVertical, Pencil, Plus, School, Trash2 } from 'lucide-react';

import {
  createProgramSchema,
  institutionTypes,
  type CreateProgramInput,
  type Program,
} from '../../features/institution/institution.schema.js';
import {
  useCreateProgram,
  useDeleteProgram,
  usePrograms,
  useUpdateProgram,
} from '../../features/institution/useInstitution.js';
import { ApiError } from '../../lib/apiError.js';
import { toast } from '../../lib/toast.js';
import { AppShell } from '../../components/layout/AppShell.js';
import { PageHeader } from '../../components/layout/PageHeader.js';
import { Button } from '../../components/ui/Button.js';
import { Badge } from '../../components/ui/Badge.js';
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

const typeLabels: Record<(typeof institutionTypes)[number], string> = {
  school: 'School',
  college: 'College',
  university: 'University',
};

const typeOptions = institutionTypes.map((value) => ({ value, label: typeLabels[value] }));

export const ProgramsPage = () => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Program | null>(null);
  const [deleting, setDeleting] = useState<Program | null>(null);
  const { data: programs, isLoading } = usePrograms();
  const createProgram = useCreateProgram();
  const updateProgram = useUpdateProgram();
  const deleteProgram = useDeleteProgram();

  const {
    register: field,
    handleSubmit,
    control,
    reset: resetForm,
    formState: { errors },
  } = useForm<CreateProgramInput>({ resolver: zodResolver(createProgramSchema) });

  const openCreate = () => {
    setEditing(null);
    resetForm({ name: '', institutionType: undefined, description: '', affiliation: '' });
    setDialogOpen(true);
  };

  const openEdit = (program: Program) => {
    setEditing(program);
    resetForm({
      name: program.name,
      institutionType: program.institutionType,
      description: program.description ?? '',
      affiliation: program.affiliation ?? '',
    });
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    resetForm();
    createProgram.reset();
    updateProgram.reset();
  };

  const onSubmit = handleSubmit(async (values) => {
    if (editing) {
      const updated = await updateProgram.mutateAsync({ id: editing.id, input: values });
      toast.success(`${updated.name} updated`);
    } else {
      const created = await createProgram.mutateAsync(values);
      toast.success(`${created.name} created`);
    }
    closeDialog();
  });

  const confirmDelete = async () => {
    if (!deleting) return;
    try {
      await deleteProgram.mutateAsync(deleting.id);
      toast.success(`${deleting.name} deleted`);
      setDeleting(null);
    } catch (caught) {
      if (caught instanceof ApiError) {
        toast.error(caught.message);
      }
    }
  };

  const error = editing ? updateProgram.error : createProgram.error;
  const isPending = editing ? updateProgram.isPending : createProgram.isPending;

  return (
    <AppShell>
      <PageHeader
        title="Programs"
        description="The top level of your institution's academic structure."
        actions={
          <Button onClick={openCreate}>
            <Plus className="size-4" aria-hidden />
            New program
          </Button>
        }
      />

      {isLoading ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : !programs || programs.length === 0 ? (
        <EmptyState
          icon={School}
          title="No programs yet"
          description="Create your first program — a school, college, or university track — to start building out classes and courses."
          action={<Button onClick={openCreate}>Create a program</Button>}
        />
      ) : (
        <Table>
          <TableHead>
            <TableRow>
              <TableHeadCell>Name</TableHeadCell>
              <TableHeadCell>Type</TableHeadCell>
              <TableHeadCell>Affiliation</TableHeadCell>
              <TableHeadCell>Description</TableHeadCell>
              <TableHeadCell />
            </TableRow>
          </TableHead>
          <TableBody>
            {programs.map((program) => (
              <TableRow key={program.id}>
                <TableCell className="font-medium">{program.name}</TableCell>
                <TableCell>
                  <Badge variant="primary">{typeLabels[program.institutionType]}</Badge>
                </TableCell>
                <TableCell className="text-muted">{program.affiliation ?? '—'}</TableCell>
                <TableCell className="text-muted">{program.description ?? '—'}</TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger className="rounded-control p-1.5 text-subtle transition-colors hover:bg-surface-hover hover:text-fg">
                      <MoreVertical className="size-4" aria-hidden />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      <DropdownMenuItem onSelect={() => openEdit(program)}>
                        <Pencil className="size-4" aria-hidden />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => setDeleting(program)} destructive>
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
        title={editing ? 'Edit program' : 'New program'}
        description="Programs are the top level of your academic hierarchy — a school, college, or university track."
      >
        <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
          {error instanceof ApiError ? <Alert>{error.message}</Alert> : null}

          <Field label="Name" htmlFor="name" error={errors.name?.message}>
            <Input id="name" placeholder="e.g. Upper School" {...field('name')} />
          </Field>

          <Field
            label="Institution type"
            htmlFor="institutionType"
            error={errors.institutionType?.message}
          >
            <Controller
              control={control}
              name="institutionType"
              render={({ field: selectField }) => (
                <Select
                  id="institutionType"
                  options={typeOptions}
                  value={selectField.value}
                  onValueChange={selectField.onChange}
                  invalid={Boolean(errors.institutionType)}
                  placeholder="Select a type"
                />
              )}
            />
          </Field>

          <Field
            label="Affiliation"
            htmlFor="affiliation"
            error={errors.affiliation?.message}
            hint="Optional — e.g. a degree program affiliated to a university"
          >
            <Input
              id="affiliation"
              placeholder="e.g. Affiliated to Tribhuwan University"
              {...field('affiliation')}
            />
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
              {editing ? 'Save changes' : 'Create program'}
            </Button>
          </div>
        </form>
      </Dialog>

      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Delete this program?"
        description={`${deleting?.name} will be permanently removed. This can't be undone, and fails if it still has classes.`}
        confirmLabel="Delete"
        destructive
        loading={deleteProgram.isPending}
        onConfirm={confirmDelete}
      />
    </AppShell>
  );
};
