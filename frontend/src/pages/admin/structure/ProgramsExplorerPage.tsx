import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowRight, MoreVertical, Pencil, Plus, School, Trash2 } from 'lucide-react';

import {
  createProgramSchema,
  institutionTypes,
  type CreateProgramInput,
  type Program,
} from '../../../features/institution/institution.schema.js';
import {
  useClasses,
  useCreateProgram,
  useDeleteProgram,
  usePrograms,
  useUpdateProgram,
} from '../../../features/institution/useInstitution.js';
import { ApiError } from '../../../lib/apiError.js';
import { toast } from '../../../lib/toast.js';
import { AppShell } from '../../../components/layout/AppShell.js';
import { PageHeader } from '../../../components/layout/PageHeader.js';
import { Button } from '../../../components/ui/Button.js';
import { Badge } from '../../../components/ui/Badge.js';
import { Card } from '../../../components/ui/Card.js';
import { Field } from '../../../components/ui/Field.js';
import { Input } from '../../../components/ui/Input.js';
import { Select } from '../../../components/ui/Select.js';
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
import { HierarchyLegend } from './HierarchyLegend.js';

const typeLabels: Record<(typeof institutionTypes)[number], string> = {
  school: 'School',
  college: 'College',
  university: 'University',
};

const typeOptions = institutionTypes.map((value) => ({ value, label: typeLabels[value] }));

export const ProgramsExplorerPage = () => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Program | null>(null);
  const [deleting, setDeleting] = useState<Program | null>(null);
  const { data: programs, isLoading } = usePrograms();
  const { data: classes } = useClasses();
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

  const classCount = (programId: string) =>
    classes?.filter((c) => c.programId === programId).length ?? 0;

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
        title="Structure"
        description="Your institution's academic hierarchy — start with a program, then drill into its classes."
        actions={
          <Button onClick={openCreate}>
            <Plus className="size-4" aria-hidden />
            New program
          </Button>
        }
      />

      <HierarchyLegend />

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      ) : !programs || programs.length === 0 ? (
        <EmptyState
          icon={School}
          title="A Program is the top of your structure"
          description="e.g. Bachelor of Computer Science, or High School. Create your first one to start adding classes."
          action={<Button onClick={openCreate}>Create a program</Button>}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {programs.map((program) => (
            <Card key={program.id} padding="md" className="flex flex-col gap-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-base font-semibold text-fg">{program.name}</p>
                  <Badge variant="primary" className="mt-1.5">
                    {typeLabels[program.institutionType]}
                  </Badge>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger className="shrink-0 rounded-control p-1.5 text-subtle transition-colors hover:bg-surface-hover hover:text-fg">
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
              </div>

              {program.affiliation ? (
                <p className="truncate text-xs text-muted">{program.affiliation}</p>
              ) : null}

              <Link
                to={`/admin/structure/${program.id}`}
                className="mt-auto flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
              >
                {classCount(program.id)} class{classCount(program.id) === 1 ? '' : 'es'}
                <ArrowRight className="size-3.5" aria-hidden />
              </Link>
            </Card>
          ))}
        </div>
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
