import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { LayoutGrid, MoreVertical, Pencil, Plus, Trash2 } from 'lucide-react';

import {
  createSectionSchema,
  type CreateSectionInput,
  type Section,
} from '../../features/institution/institution.schema.js';
import {
  useAcademicYears,
  useClasses,
  useCreateSection,
  useDeleteSection,
  useSections,
  useUpdateSection,
} from '../../features/institution/useInstitution.js';
import { useTeachers } from '../../features/users/useUsers.js';
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

export const SectionsPage = () => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Section | null>(null);
  const [deleting, setDeleting] = useState<Section | null>(null);
  const { data: sections, isLoading } = useSections();
  const { data: classes } = useClasses();
  const { data: years } = useAcademicYears();
  const { data: teachers } = useTeachers();
  const createSection = useCreateSection();
  const updateSection = useUpdateSection();
  const deleteSection = useDeleteSection();

  const {
    register: field,
    handleSubmit,
    control,
    reset: resetForm,
    formState: { errors },
  } = useForm<CreateSectionInput>({ resolver: zodResolver(createSectionSchema) });

  const className = (id: string) => classes?.find((c) => c.id === id)?.name ?? '—';
  const yearName = (id: string) => years?.find((y) => y.id === id)?.name ?? '—';
  const teacherName = (id: string | null) => teachers?.find((t) => t.id === id)?.name ?? null;

  const openCreate = () => {
    setEditing(null);
    resetForm({ classId: undefined, academicYearId: undefined, name: '', classTeacherId: undefined });
    setDialogOpen(true);
  };

  const openEdit = (section: Section) => {
    setEditing(section);
    resetForm({
      classId: section.classId,
      academicYearId: section.academicYearId,
      name: section.name,
      classTeacherId: section.classTeacherId ?? undefined,
    });
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    resetForm();
    createSection.reset();
    updateSection.reset();
  };

  const onSubmit = handleSubmit(async (values) => {
    if (editing) {
      const updated = await updateSection.mutateAsync({ id: editing.id, input: values });
      toast.success(`Section ${updated.name} updated`);
    } else {
      const created = await createSection.mutateAsync(values);
      toast.success(`Section ${created.name} created`);
    }
    closeDialog();
  });

  const confirmDelete = async () => {
    if (!deleting) return;
    try {
      await deleteSection.mutateAsync(deleting.id);
      toast.success(`Section ${deleting.name} deleted`);
      setDeleting(null);
    } catch (caught) {
      if (caught instanceof ApiError) {
        toast.error(caught.message);
      }
    }
  };

  const error = editing ? updateSection.error : createSection.error;
  const isPending = editing ? updateSection.isPending : createSection.isPending;

  const canCreate = Boolean(classes?.length && years?.length);
  const classOptions = (classes ?? []).map((c) => ({ value: c.id, label: c.name }));
  const yearOptions = (years ?? []).map((y) => ({ value: y.id, label: y.name }));
  const teacherOptions = (teachers ?? []).map((t) => ({ value: t.id, label: t.name }));

  return (
    <AppShell>
      <PageHeader
        title="Sections"
        description="A class split by academic year — e.g. Grade 10A for 2026–2027."
        actions={
          <Button onClick={openCreate} disabled={!canCreate}>
            <Plus className="size-4" aria-hidden />
            New section
          </Button>
        }
      />

      {isLoading ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : !canCreate ? (
        <EmptyState
          icon={LayoutGrid}
          title="Create a class and an academic year first"
          description="Sections belong to both a class and an academic year."
        />
      ) : !sections || sections.length === 0 ? (
        <EmptyState
          icon={LayoutGrid}
          title="No sections yet"
          description="Create a section to start placing students into it."
          action={<Button onClick={openCreate}>Create a section</Button>}
        />
      ) : (
        <Table>
          <TableHead>
            <TableRow>
              <TableHeadCell>Name</TableHeadCell>
              <TableHeadCell>Class</TableHeadCell>
              <TableHeadCell>Academic year</TableHeadCell>
              <TableHeadCell>Class teacher</TableHeadCell>
              <TableHeadCell />
            </TableRow>
          </TableHead>
          <TableBody>
            {sections.map((section) => (
              <TableRow key={section.id}>
                <TableCell className="font-medium">{section.name}</TableCell>
                <TableCell className="text-muted">{className(section.classId)}</TableCell>
                <TableCell className="text-muted">{yearName(section.academicYearId)}</TableCell>
                <TableCell>
                  {teacherName(section.classTeacherId) ? (
                    teacherName(section.classTeacherId)
                  ) : (
                    <Badge>Unassigned</Badge>
                  )}
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger className="rounded-control p-1.5 text-subtle transition-colors hover:bg-surface-hover hover:text-fg">
                      <MoreVertical className="size-4" aria-hidden />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      <DropdownMenuItem onSelect={() => openEdit(section)}>
                        <Pencil className="size-4" aria-hidden />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => setDeleting(section)} destructive>
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
        title={editing ? 'Edit section' : 'New section'}
        description="Assigning a class teacher is optional and can be done later."
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

          <Field label="Academic year" htmlFor="academicYearId" error={errors.academicYearId?.message}>
            <Controller
              control={control}
              name="academicYearId"
              render={({ field: selectField }) => (
                <Select
                  id="academicYearId"
                  options={yearOptions}
                  value={selectField.value}
                  onValueChange={selectField.onChange}
                  invalid={Boolean(errors.academicYearId)}
                  placeholder="Select an academic year"
                />
              )}
            />
          </Field>

          <Field label="Name" htmlFor="name" error={errors.name?.message}>
            <Input id="name" placeholder="e.g. A" {...field('name')} />
          </Field>

          <Field
            label="Class teacher"
            htmlFor="classTeacherId"
            error={errors.classTeacherId?.message}
            hint={teacherOptions.length ? 'Optional' : 'No teacher accounts exist yet — optional'}
          >
            <Controller
              control={control}
              name="classTeacherId"
              render={({ field: selectField }) => (
                <Select
                  id="classTeacherId"
                  options={teacherOptions}
                  value={selectField.value}
                  onValueChange={selectField.onChange}
                  invalid={Boolean(errors.classTeacherId)}
                  placeholder="No class teacher assigned"
                />
              )}
            />
          </Field>

          <div className="mt-2 flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={closeDialog}>
              Cancel
            </Button>
            <Button type="submit" loading={isPending}>
              {editing ? 'Save changes' : 'Create section'}
            </Button>
          </div>
        </form>
      </Dialog>

      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Delete this section?"
        description={`Section ${deleting?.name} will be permanently removed. This can't be undone, and fails if students are placed in it.`}
        confirmLabel="Delete"
        destructive
        loading={deleteSection.isPending}
        onConfirm={confirmDelete}
      />
    </AppShell>
  );
};
