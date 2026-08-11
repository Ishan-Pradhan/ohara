import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CalendarRange, MoreVertical, Pencil, Plus, Trash2 } from 'lucide-react';

import {
  createAcademicYearSchema,
  academicYearTerms,
  type AcademicYear,
  type CreateAcademicYearInput,
} from '../../features/institution/institution.schema.js';
import {
  useAcademicYears,
  useCreateAcademicYear,
  useDeleteAcademicYear,
  useUpdateAcademicYear,
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
import { Checkbox } from '../../components/ui/Checkbox.js';
import { Skeleton } from '../../components/ui/Skeleton.js';
import { EmptyState } from '../../components/ui/EmptyState.js';
import { Dialog, ConfirmDialog } from '../../components/ui/Dialog.js';
import { Alert } from '../../components/ui/Alert.js';
import { BlockersList } from '../../components/ui/BlockersList.js';
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

export const AcademicYearsPage = () => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<AcademicYear | null>(null);
  const [deleting, setDeleting] = useState<AcademicYear | null>(null);
  const [deleteError, setDeleteError] = useState<ApiError | null>(null);
  const { data: years, isLoading } = useAcademicYears();
  const createAcademicYear = useCreateAcademicYear();
  const updateAcademicYear = useUpdateAcademicYear();
  const deleteAcademicYear = useDeleteAcademicYear();

  const {
    register: field,
    handleSubmit,
    control,
    reset: resetForm,
    formState: { errors },
  } = useForm<CreateAcademicYearInput>({ resolver: zodResolver(createAcademicYearSchema) });

  const openCreate = () => {
    setEditing(null);
    resetForm({ name: '', startDate: '', endDate: '', isCurrent: false, term: 'annual' });
    setDialogOpen(true);
  };

  const openEdit = (year: AcademicYear) => {
    setEditing(year);
    resetForm({
      name: year.name,
      startDate: year.startDate,
      endDate: year.endDate,
      isCurrent: year.isCurrent,
      term: year.term,
    });
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    resetForm();
    createAcademicYear.reset();
    updateAcademicYear.reset();
  };

  const onSubmit = handleSubmit(async (values) => {
    if (editing) {
      const updated = await updateAcademicYear.mutateAsync({ id: editing.id, input: values });
      toast.success(`${updated.name} updated`);
    } else {
      const created = await createAcademicYear.mutateAsync(values);
      toast.success(`${created.name} created${created.isCurrent ? ' and set as current' : ''}`);
    }
    closeDialog();
  });

  const confirmDelete = async () => {
    if (!deleting) return;
    setDeleteError(null);
    try {
      await deleteAcademicYear.mutateAsync(deleting.id);
      toast.success(`${deleting.name} deleted`);
      setDeleting(null);
    } catch (caught) {
      if (caught instanceof ApiError) {
        setDeleteError(caught);
      }
    }
  };

  const error = editing ? updateAcademicYear.error : createAcademicYear.error;
  const isPending = editing ? updateAcademicYear.isPending : createAcademicYear.isPending;

  return (
    <AppShell>
      <PageHeader
        title="Academic years"
        description="One current year per term — an odd-semester and an even-semester year can both be current at once."
        actions={
          <Button onClick={openCreate}>
            <Plus className="size-4" aria-hidden />
            New academic year
          </Button>
        }
      />

      {isLoading ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : !years || years.length === 0 ? (
        <EmptyState
          icon={CalendarRange}
          title="No academic years yet"
          description="Create the first academic year and mark it current to start placing students."
          action={<Button onClick={openCreate}>Create an academic year</Button>}
        />
      ) : (
        <Table>
          <TableHead>
            <TableRow>
              <TableHeadCell>Name</TableHeadCell>
              <TableHeadCell>Term</TableHeadCell>
              <TableHeadCell>Starts</TableHeadCell>
              <TableHeadCell>Ends</TableHeadCell>
              <TableHeadCell>Status</TableHeadCell>
              <TableHeadCell />
            </TableRow>
          </TableHead>
          <TableBody>
            {years.map((year) => (
              <TableRow key={year.id}>
                <TableCell className="font-medium">{year.name}</TableCell>
                <TableCell>
                  <Badge variant={year.term === 'annual' ? 'neutral' : 'primary'} className="capitalize">
                    {year.term}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted">{year.startDate}</TableCell>
                <TableCell className="text-muted">{year.endDate}</TableCell>
                <TableCell>
                  {year.isCurrent ? (
                    <Badge variant="accent">Current</Badge>
                  ) : (
                    <Badge>Past / upcoming</Badge>
                  )}
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger className="rounded-control p-1.5 text-subtle transition-colors hover:bg-surface-hover hover:text-fg">
                      <MoreVertical className="size-4" aria-hidden />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      <DropdownMenuItem onSelect={() => openEdit(year)}>
                        <Pencil className="size-4" aria-hidden />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => setDeleting(year)} destructive>
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
        title={editing ? 'Edit academic year' : 'New academic year'}
        description="Marking this current unsets whichever year was current before, within the same term."
      >
        <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
          {error instanceof ApiError ? <Alert>{error.message}</Alert> : null}

          <Field label="Name" htmlFor="name" error={errors.name?.message}>
            <Input id="name" placeholder="e.g. 2026/27 odd" {...field('name')} />
          </Field>

          <Controller
            control={control}
            name="term"
            render={({ field: termField }) => (
              <Field
                label="Term"
                htmlFor="term"
                hint="Odd (1/3/5/7) and even (2/4/6/8) semesters run on offset calendars — pick 'Annual' for schools, which don't split into odd/even."
              >
                <Select
                  id="term"
                  value={termField.value}
                  onValueChange={termField.onChange}
                  options={academicYearTerms.map((t) => ({
                    value: t,
                    label: t === 'annual' ? 'Annual (schools)' : t === 'odd' ? 'Odd semesters' : 'Even semesters',
                  }))}
                />
              </Field>
            )}
          />

          <div className="grid grid-cols-2 gap-3">
            <Field label="Start date" htmlFor="startDate" error={errors.startDate?.message}>
              <Input id="startDate" type="date" {...field('startDate')} />
            </Field>
            <Field label="End date" htmlFor="endDate" error={errors.endDate?.message}>
              <Input id="endDate" type="date" {...field('endDate')} />
            </Field>
          </div>

          <Controller
            control={control}
            name="isCurrent"
            render={({ field: checkboxField }) => (
              <label className="flex cursor-pointer items-center gap-2.5 text-sm text-fg">
                <Checkbox
                  checked={checkboxField.value ?? false}
                  onCheckedChange={checkboxField.onChange}
                />
                Set as the current academic year
              </label>
            )}
          />

          <div className="mt-2 flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={closeDialog}>
              Cancel
            </Button>
            <Button type="submit" loading={isPending}>
              {editing ? 'Save changes' : 'Create academic year'}
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
        title="Delete this academic year?"
        description={`${deleting?.name} will be permanently removed. This can't be undone, and fails if it still has sections.`}
        confirmLabel="Delete"
        destructive
        loading={deleteAcademicYear.isPending}
        onConfirm={confirmDelete}
      >
        {deleteError ? <BlockersList blockers={deleteError.blockers} /> : null}
      </ConfirmDialog>
    </AppShell>
  );
};
