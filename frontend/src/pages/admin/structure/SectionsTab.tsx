import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  ArrowUpCircle,
  CalendarRange,
  LayoutGrid,
  MoreVertical,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react';
import { z } from 'zod';

import type { InstitutionType, Section } from '../../../features/institution/institution.schema.js';
import {
  useAcademicYears,
  useClasses,
  useCreateSection,
  useDeleteSection,
  useSections,
  useUpdateSection,
} from '../../../features/institution/useInstitution.js';
import { deriveClassTerm } from '../../../lib/academicTerm.js';
import { useTeachers } from '../../../features/users/useUsers.js';
import {
  useBulkPromoteSection,
  useSectionRoster,
} from '../../../features/placement/usePlacement.js';
import type { BulkPromoteResult } from '../../../features/placement/placement.schema.js';
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
  institutionType: InstitutionType;
  orderIndex: number;
}

export const SectionsTab = ({ classId, institutionType, orderIndex }: SectionsTabProps) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [showAllYears, setShowAllYears] = useState(false);
  const { data: years, isLoading: yearsLoading } = useAcademicYears();
  const { data: sections, isLoading: sectionsLoading } = useSections();
  const { data: classes } = useClasses();
  const { data: teachers } = useTeachers();
  const createSection = useCreateSection();
  const updateSection = useUpdateSection();
  const deleteSection = useDeleteSection();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Section | null>(null);
  const [deleting, setDeleting] = useState<Section | null>(null);
  const [promoting, setPromoting] = useState<Section | null>(null);

  // This class only ever runs in years matching its own term (annual for
  // schools; odd/even for college/university, derived from the semester
  // number) — filtering to those avoids mixing in an unrelated program's or
  // the opposite-parity semester's years, which is what made the year
  // dropdown confusing before. "Show all" is an escape hatch for browsing
  // history or fixing a miscategorized year.
  const classTerm = deriveClassTerm(institutionType, orderIndex);
  const termYears = (years ?? []).filter((y) => y.term === classTerm);
  const relevantYears = showAllYears || termYears.length === 0 ? years ?? [] : termYears;

  const selectedYearId =
    searchParams.get('year') ??
    relevantYears.find((y) => y.isCurrent)?.id ??
    relevantYears[0]?.id ??
    '';

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
  const yearOptions = relevantYears.map((y) => ({ value: y.id, label: y.name }));

  // Promotion always moves a section's students into the same program's next
  // class (by orderIndex), regardless of which academic year that class's
  // sections belong to — mirrors StudentDetailPage's OutcomeDialog logic.
  const currentClass = classes?.find((c) => c.id === classId);
  // Retention keeps a student in this same class, possibly moving them to a
  // different section within it — mirrors StudentDetailPage's OutcomeDialog
  // retainedSectionOptions (filtered by classId only, no year constraint).
  const retainedSectionOptions = (sections ?? [])
    .filter((s) => s.classId === currentClass?.id)
    .map((s) => {
      const yearName = years?.find((y) => y.id === s.academicYearId)?.name ?? '—';
      return { value: s.id, label: `${s.name} (${yearName})` };
    });
  const promotedSectionOptions = (sections ?? [])
    .filter((s) => {
      const targetClass = classes?.find((c) => c.id === s.classId);
      return (
        targetClass &&
        currentClass &&
        targetClass.programId === currentClass.programId &&
        targetClass.orderIndex === currentClass.orderIndex + 1
      );
    })
    .map((s) => {
      const className = classes?.find((c) => c.id === s.classId)?.name ?? '—';
      const yearName = years?.find((y) => y.id === s.academicYearId)?.name ?? '—';
      return { value: s.id, label: `${className} — ${s.name} (${yearName})` };
    });

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
        <div className="flex items-center gap-3">
          <div className="max-w-xs">
            <Select
              value={selectedYearId}
              onValueChange={(value) => setSearchParams({ year: value })}
              options={yearOptions}
              placeholder="Select a year"
            />
          </div>
          {termYears.length > 0 ? (
            <button
              type="button"
              onClick={() => setShowAllYears((prev) => !prev)}
              className="text-xs font-medium text-primary hover:underline"
            >
              {showAllYears
                ? `Show only ${classTerm === 'annual' ? 'annual' : classTerm + '-semester'} years`
                : 'Show all years'}
            </button>
          ) : null}
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
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={section.enrolledCount === 0}
                  onClick={() => setPromoting(section)}
                >
                  <ArrowUpCircle className="size-4" aria-hidden />
                  Promote all
                </Button>
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

      <BulkPromoteDialog
        section={promoting}
        promotedSectionOptions={promotedSectionOptions}
        retainedSectionOptions={retainedSectionOptions}
        onOpenChange={(open) => !open && setPromoting(null)}
      />
    </div>
  );
};

const outcomeOverrideOptions = [
  { value: 'promoted', label: 'Promote' },
  { value: 'retained', label: 'Retained' },
  { value: 'graduated', label: 'Graduated' },
];

interface OverrideState {
  outcome: 'retained' | 'graduated';
  /** Only meaningful (and required before submit) when outcome === 'retained' —
   * graduation never needs a target section, and omitting it there is what
   * correctly signals graduation to the backend. */
  targetSectionId?: string;
}

interface BulkPromoteDialogProps {
  section: Section | null;
  promotedSectionOptions: { value: string; label: string }[];
  retainedSectionOptions: { value: string; label: string }[];
  onOpenChange: (open: boolean) => void;
}

const BulkPromoteDialog = ({
  section,
  promotedSectionOptions,
  retainedSectionOptions,
  onOpenChange,
}: BulkPromoteDialogProps) => {
  const sectionId = section?.id ?? '';
  const { data: roster, isLoading: rosterLoading, isError: rosterError } = useSectionRoster(sectionId);
  const bulkPromote = useBulkPromoteSection(sectionId);

  const [defaultTargetSectionId, setDefaultTargetSectionId] = useState('');
  const [overrides, setOverrides] = useState<Record<string, OverrideState>>({});
  const [results, setResults] = useState<BulkPromoteResult[] | null>(null);

  // Reset local state whenever a different section is opened (or the dialog closes).
  useEffect(() => {
    setDefaultTargetSectionId('');
    setOverrides({});
    setResults(null);
    bulkPromote.reset();
    // Only re-run when switching sections — bulkPromote itself is intentionally
    // excluded, since including it would re-fire this effect on every mutation
    // state change (isPending/error) rather than only on section switches.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [sectionId]);

  const setOverrideOutcome = (studentId: string, outcome: string) => {
    setOverrides((prev) => {
      const next = { ...prev };
      if (outcome === 'promoted') {
        delete next[studentId];
      } else if (outcome === 'retained') {
        // Keep a previously chosen target section if the admin flips back to
        // 'retained' after trying something else.
        next[studentId] = { outcome: 'retained', targetSectionId: next[studentId]?.targetSectionId };
      } else {
        next[studentId] = { outcome: 'graduated' };
      }
      return next;
    });
  };

  const setOverrideTargetSection = (studentId: string, targetSectionId: string) => {
    setOverrides((prev) => {
      const existing = prev[studentId];
      if (!existing) return prev;
      return { ...prev, [studentId]: { ...existing, targetSectionId } };
    });
  };

  const hasIncompleteRetainedOverride = Object.values(overrides).some(
    (o) => o.outcome === 'retained' && !o.targetSectionId,
  );

  const submit = async () => {
    if (!section) return;
    const payload = {
      defaultTargetSectionId,
      overrides: Object.entries(overrides).map(([studentId, o]) => ({
        studentId,
        outcome: o.outcome,
        targetSectionId: o.outcome === 'retained' ? o.targetSectionId : undefined,
      })),
    };
    const outcomeResults = await bulkPromote.mutateAsync(payload);
    setResults(outcomeResults);
    const okCount = outcomeResults.filter((r) => r.status === 'ok').length;
    toast.success(`${okCount} of ${outcomeResults.length} students promoted`);
    if (outcomeResults.every((r) => r.status === 'ok')) {
      onOpenChange(false);
    }
  };

  const errorResults = (results ?? []).filter((r) => r.status === 'error');
  const studentName = (studentId: string) =>
    roster?.find((entry) => entry.student.id === studentId)?.student.name ?? studentId;

  return (
    <Dialog
      open={Boolean(section)}
      onOpenChange={onOpenChange}
      title={`Promote all — ${section?.name ?? ''}`}
      description="Applies to every student currently placed in this section. Override individual students below before submitting."
    >
      <div className="flex flex-col gap-4">
        {bulkPromote.error instanceof ApiError ? <Alert>{bulkPromote.error.message}</Alert> : null}

        {errorResults.length > 0 ? (
          <Alert variant="warning">
            <p className="mb-1 font-medium">Some students could not be promoted:</p>
            <ul className="flex flex-col gap-0.5">
              {errorResults.map((r) => (
                <li key={r.studentId}>
                  <span className="font-medium">{studentName(r.studentId)}</span>: {r.error}
                </li>
              ))}
            </ul>
          </Alert>
        ) : null}

        {rosterLoading ? (
          <Skeleton className="h-32 w-full" />
        ) : rosterError ? (
          <Alert>Could not load this section's roster.</Alert>
        ) : !roster || roster.length === 0 ? (
          <p className="text-sm text-muted">No students are placed in this section.</p>
        ) : (
          <>
            <Field label="Default target section" htmlFor="defaultTargetSectionId" hint="Applied to every student not overridden below.">
              <Select
                id="defaultTargetSectionId"
                options={promotedSectionOptions}
                value={defaultTargetSectionId}
                onValueChange={setDefaultTargetSectionId}
                placeholder={
                  promotedSectionOptions.length
                    ? 'Select a section'
                    : 'No next-class sections exist for this program yet'
                }
              />
            </Field>

            <div className="flex flex-col gap-2">
              {roster.map((entry) => {
                const override = overrides[entry.student.id];
                return (
                  <div
                    key={entry.membershipId}
                    className="flex flex-col gap-2 rounded-control border border-border px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-fg">{entry.student.name}</p>
                      <p className="truncate text-xs text-muted">{entry.student.email}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {override?.outcome === 'retained' ? (
                        <div className="w-44">
                          <Select
                            options={retainedSectionOptions}
                            value={override.targetSectionId ?? ''}
                            onValueChange={(value) => setOverrideTargetSection(entry.student.id, value)}
                            placeholder="Target section"
                            invalid={!override.targetSectionId}
                          />
                        </div>
                      ) : null}
                      <div className="w-36">
                        <Select
                          options={outcomeOverrideOptions}
                          value={override?.outcome ?? 'promoted'}
                          onValueChange={(value) => setOverrideOutcome(entry.student.id, value)}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        <div className="mt-2 flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          {roster && roster.length > 0 ? (
            <Button
              type="button"
              loading={bulkPromote.isPending}
              disabled={!defaultTargetSectionId || hasIncompleteRetainedOverride}
              onClick={submit}
            >
              Promote all
            </Button>
          ) : null}
        </div>
      </div>
    </Dialog>
  );
};
