import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CalendarRange, LayoutGrid, MoreVertical, Pencil, Plus, Trash2 } from 'lucide-react';
import { z } from 'zod';

import type { Section } from '../../../features/institution/institution.schema.js';
import {
  useAcademicYears,
  useCreateSection,
  useDeleteSection,
  useSections,
  useUpdateSection,
} from '../../../features/institution/useInstitution.js';
import { useTeachers } from '../../../features/users/useUsers.js';
import { ApiError } from '../../../lib/apiError.js';
import { toast } from '../../../lib/toast.js';
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

const sectionFormSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  classTeacherId: z.string().optional(),
  capacity: z.number().int().positive().optional(),
});

type SectionFormInput = z.infer<typeof sectionFormSchema>;

interface SectionsTabProps {
  classId: string;
}

export const SectionsTab = ({ classId }: SectionsTabProps) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: years, isLoading: yearsLoading } = useAcademicYears();
  const { data: sections, isLoading: sectionsLoading } = useSections();
  const { data: teachers } = useTeachers();
  const createSection = useCreateSection();
  const updateSection = useUpdateSection();
  const deleteSection = useDeleteSection();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Section | null>(null);
  const [deleting, setDeleting] = useState<Section | null>(null);

  const selectedYearId =
    searchParams.get('year') ?? years?.find((y) => y.isCurrent)?.id ?? years?.[0]?.id ?? '';

  const classSections = (sections ?? []).filter(
    (s) => s.classId === classId && s.academicYearId === selectedYearId,
  );

  const {
    register: field,
    handleSubmit,
    control,
    reset: resetForm,
    formState: { errors },
  } = useForm<SectionFormInput>({ resolver: zodResolver(sectionFormSchema) });

  const teacherName = (id: string | null) => teachers?.find((t) => t.id === id)?.name ?? null;
  const teacherOptions = (teachers ?? []).map((t) => ({ value: t.id, label: t.name }));
  const yearOptions = (years ?? []).map((y) => ({ value: y.id, label: y.name }));

  const openCreate = () => {
    setEditing(null);
    resetForm({ name: '', classTeacherId: undefined, capacity: undefined });
    setDialogOpen(true);
  };

  const openEdit = (section: Section) => {
    setEditing(section);
    resetForm({ name: section.name, classTeacherId: section.classTeacherId ?? undefined, capacity: section.capacity ?? undefined });
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    resetForm();
    createSection.reset();
    updateSection.reset();
  };

  const onSubmit = handleSubmit(async (values) => {
    const input = { ...values, classId, academicYearId: selectedYearId };
    if (editing) {
      const updated = await updateSection.mutateAsync({ id: editing.id, input });
      toast.success(`Section ${updated.name} updated`);
    } else {
      const created = await createSection.mutateAsync(input);
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
  const isLoading = yearsLoading || sectionsLoading;
  const selectedYear = years?.find((y) => y.id === selectedYearId);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-2">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-12 w-full" />
      </div>
    );
  }

  if (!years || years.length === 0) {
    return (
      <EmptyState
        icon={CalendarRange}
        title="Create an academic year first"
        description="Sections belong to a specific academic year, like 2025/26."
        action={
          <Link
            to="/admin/academic-years"
            className="inline-flex items-center justify-center gap-2 rounded-control bg-primary px-4 py-2.5 text-sm font-medium text-primary-fg hover:bg-primary-hover"
          >
            Go to Academic years
          </Link>
        }
      />
    );
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="max-w-xs">
          <Select
            value={selectedYearId}
            onValueChange={(value) => setSearchParams({ year: value })}
            options={yearOptions}
            placeholder="Select a year"
          />
        </div>
        <Button size="sm" onClick={openCreate}>
          <Plus className="size-4" aria-hidden />
          Add section
        </Button>
      </div>

      {classSections.length === 0 ? (
        <EmptyState
          icon={LayoutGrid}
          title={`No sections yet for ${selectedYear?.name ?? 'this year'}`}
          description="Create one to start placing students into it."
          action={<Button onClick={openCreate}>Create a section</Button>}
        />
      ) : (
        <div className="flex flex-col gap-2">
          {classSections.map((section) => (
            <Card key={section.id} padding="sm" className="flex items-center justify-between gap-3">
              <p className="text-sm font-medium text-fg">{section.name}</p>
              <div className="flex items-center gap-2">
                {teacherName(section.classTeacherId) ? (
                  <Badge variant="primary">{teacherName(section.classTeacherId)}</Badge>
                ) : (
                  <Badge>Unassigned</Badge>
                )}
                {section.capacity !== null ? (
                  <Badge variant={section.enrolledCount >= section.capacity ? 'warning' : 'neutral'}>
                    {section.enrolledCount}/{section.capacity}
                  </Badge>
                ) : (
                  <Badge>{section.enrolledCount} student{section.enrolledCount === 1 ? '' : 's'}</Badge>
                )}
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
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => (open ? setDialogOpen(true) : closeDialog())}
        title={editing ? 'Edit section' : 'New section'}
        description={`For ${selectedYear?.name ?? 'the selected year'}. Assigning a class teacher is optional.`}
      >
        <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
          {error instanceof ApiError ? <Alert>{error.message}</Alert> : null}

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

          <Field
            label="Capacity"
            htmlFor="capacity"
            error={errors.capacity?.message}
            hint="Optional — leave blank for no limit"
          >
            <Input
              id="capacity"
              type="number"
              {...field('capacity', { valueAsNumber: true })}
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
    </div>
  );
};
