import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  ArrowUpCircle,
  BookOpen,
  GraduationCap,
  LayoutGrid,
  MoreVertical,
  Pencil,
  Plus,
  Search,
  Trash2,
  Users,
} from 'lucide-react';
import { z } from 'zod';

import type { Section } from '../../../features/institution/institution.schema.js';
import {
  useBatches,
  useClasses,
  useCourses,
  useCreateSection,
  useDeleteSection,
  useSections,
  useUpdateSection,
} from '../../../features/institution/useInstitution.js';
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
import { BlockersList } from '../../../components/ui/BlockersList.js';
import { Alert } from '../../../components/ui/Alert.js';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../../../components/ui/DropdownMenu.js';

const sectionFormSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  startDate: z.string().min(1, 'Start date is required'),
  classTeacherId: z.string().optional(),
  capacity: z.number().int().positive().optional(),
});

type SectionFormInput = z.infer<typeof sectionFormSchema>;

interface SectionsTabProps {
  classId: string;
  programId: string;
}

export const SectionsTab = ({ classId, programId }: SectionsTabProps) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: batches, isLoading: batchesLoading } = useBatches(programId);
  const { data: sections, isLoading: sectionsLoading } = useSections();
  const { data: classes } = useClasses();
  const { data: courses } = useCourses();
  const { data: teachers } = useTeachers();
  const createSection = useCreateSection();
  const updateSection = useUpdateSection();
  const deleteSection = useDeleteSection();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Section | null>(null);
  const [deleting, setDeleting] = useState<Section | null>(null);
  const [deleteError, setDeleteError] = useState<ApiError | null>(null);
  const [promoting, setPromoting] = useState<Section | null>(null);
  const [viewingCoursesFor, setViewingCoursesFor] = useState<Section | null>(null);

  // Courses belong to the class, not the section — a section's students are
  // enrolled in whichever of the class's courses apply to them, so "this
  // section's course rosters" really means "this class's courses."
  const classCourses = (courses ?? []).filter((c) => c.classId === classId);

  const selectedBatchId = searchParams.get('batch') ?? batches?.[0]?.id ?? '';

  const classSections = (sections ?? []).filter(
    (s) => s.classId === classId && s.batchId === selectedBatchId,
  );

  const {
    register: field,
    handleSubmit,
    control,
    reset: resetForm,
    formState: { errors },
  } = useForm<SectionFormInput>({ resolver: zodResolver(sectionFormSchema) });

  const teacherName = (id: string | null) => teachers?.find((t) => t.id === id)?.name ?? null;
  // Radix's Select.Item rejects an empty-string value (it's reserved
  // internally for "nothing selected" / the placeholder), so an explicit
  // "no teacher" choice needs its own sentinel rather than value: '' — there
  // was previously no way to *clear* an already-assigned class teacher once
  // set, which matters for programs that don't use the class-teacher concept
  // at all (fixed 2026-08-12).
  const NO_TEACHER_VALUE = '__none__';
  const teacherOptions = [
    { value: NO_TEACHER_VALUE, label: 'No class teacher' },
    ...(teachers ?? []).map((t) => ({ value: t.id, label: t.name })),
  ];
  const batchOptions = (batches ?? []).map((b) => ({ value: b.id, label: b.name }));

  // Promotion always moves a section's students into the same batch's next
  // class (by orderIndex) — a batch's own progression through Sem 1..N is
  // the single source of truth for "which one is current," and promotion
  // never moves a student to a different batch (mirrors
  // StudentDetailPage's OutcomeDialog logic).
  const currentClass = classes?.find((c) => c.id === classId);
  const promotedSectionOptions = (sections ?? [])
    .filter((s) => {
      const targetClass = classes?.find((c) => c.id === s.classId);
      return (
        targetClass &&
        currentClass &&
        targetClass.programId === currentClass.programId &&
        targetClass.orderIndex === currentClass.orderIndex + 1 &&
        s.batchId === promoting?.batchId
      );
    })
    .map((s) => {
      const className = classes?.find((c) => c.id === s.classId)?.name ?? '—';
      return { value: s.id, label: `${className} — ${s.name}` };
    });

  const openCreate = () => {
    setEditing(null);
    resetForm({ name: '', startDate: '', classTeacherId: undefined, capacity: undefined });
    setDialogOpen(true);
  };

  const openEdit = (section: Section) => {
    setEditing(section);
    resetForm({
      name: section.name,
      startDate: section.startDate,
      classTeacherId: section.classTeacherId ?? undefined,
      capacity: section.capacity ?? undefined,
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
      const updated = await updateSection.mutateAsync({ id: editing.id, input: { ...values, classId, batchId: selectedBatchId } });
      toast.success(`Section ${updated.name} updated`);
    } else {
      const created = await createSection.mutateAsync({ ...values, classId, batchId: selectedBatchId });
      toast.success(`Section ${created.name} created`);
    }
    closeDialog();
  });

  const confirmDelete = async () => {
    if (!deleting) return;
    setDeleteError(null);
    try {
      await deleteSection.mutateAsync(deleting.id);
      toast.success(`Section ${deleting.name} deleted`);
      setDeleting(null);
    } catch (caught) {
      if (caught instanceof ApiError) {
        setDeleteError(caught);
      }
    }
  };

  const error = editing ? updateSection.error : createSection.error;
  const isPending = editing ? updateSection.isPending : createSection.isPending;
  const isLoading = batchesLoading || sectionsLoading;
  const selectedBatch = batches?.find((b) => b.id === selectedBatchId);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-2">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-12 w-full" />
      </div>
    );
  }

  if (!batches || batches.length === 0) {
    return (
      <EmptyState
        icon={Users}
        title="Create a batch first"
        description="Sections place a batch's students into this class."
        action={
          <Link
            to={`/admin/structure/${programId}`}
            className="inline-flex items-center justify-center gap-2 rounded-control bg-primary px-4 py-2.5 text-sm font-medium text-primary-fg hover:bg-primary-hover"
          >
            Go to Batches
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
            value={selectedBatchId}
            onValueChange={(value) => setSearchParams({ batch: value })}
            options={batchOptions}
            placeholder="Select a batch"
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
          title={`No sections yet for ${selectedBatch?.name ?? 'this batch'}`}
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
                    <DropdownMenuItem onSelect={() => setViewingCoursesFor(section)}>
                      <BookOpen className="size-4" aria-hidden />
                      View course rosters
                    </DropdownMenuItem>
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
        description={`For ${selectedBatch?.name ?? 'the selected batch'}. Assigning a class teacher is optional.`}
      >
        <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
          {error instanceof ApiError ? <Alert>{error.message}</Alert> : null}

          <Field label="Name" htmlFor="name" error={errors.name?.message}>
            <Input id="name" placeholder="e.g. A" {...field('name')} />
          </Field>

          <Field
            label="Start date"
            htmlFor="startDate"
            error={errors.startDate?.message}
            hint="Display/reporting only — never used to decide what's current"
          >
            <Input id="startDate" type="date" {...field('startDate')} />
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
                  value={selectField.value || NO_TEACHER_VALUE}
                  onValueChange={(value) =>
                    selectField.onChange(value === NO_TEACHER_VALUE ? '' : value)
                  }
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
        onOpenChange={(open) => {
          if (!open) {
            setDeleting(null);
            setDeleteError(null);
          }
        }}
        title="Delete this section?"
        description={`Section ${deleting?.name} will be permanently removed. This can't be undone, and fails if students are placed in it.`}
        confirmLabel="Delete"
        destructive
        loading={deleteSection.isPending}
        onConfirm={confirmDelete}
      >
        {deleteError ? <BlockersList blockers={deleteError.blockers} /> : null}
      </ConfirmDialog>

      <BulkPromoteDialog
        section={promoting}
        promotedSectionOptions={promotedSectionOptions}
        onOpenChange={(open) => !open && setPromoting(null)}
      />

      <Dialog
        open={Boolean(viewingCoursesFor)}
        onOpenChange={(open) => !open && setViewingCoursesFor(null)}
        title={`Courses — ${viewingCoursesFor?.name ?? ''}`}
        description="Courses belong to the whole class, not just this section — pick one to see everyone enrolled in it."
      >
        {classCourses.length === 0 ? (
          <EmptyState icon={GraduationCap} title="No courses in this class yet" />
        ) : (
          <div className="flex flex-col gap-2">
            {classCourses.map((course) => (
              <Link
                key={course.id}
                to={`/admin/courses/${course.id}`}
                className="flex items-center justify-between gap-3 rounded-control border border-border px-3 py-2 text-sm transition-colors hover:border-border-strong hover:bg-surface-hover"
                onClick={() => setViewingCoursesFor(null)}
              >
                <span className="font-medium text-fg">{course.title}</span>
                <Badge>{course.enrolledCount} student{course.enrolledCount === 1 ? '' : 's'}</Badge>
              </Link>
            ))}
          </div>
        )}
      </Dialog>
    </div>
  );
};

const outcomeOverrideOptions = [
  { value: 'default', label: 'Promote (default section)' },
  { value: 'custom', label: 'Promote (choose section)' },
  { value: 'graduated', label: 'Graduated' },
];

interface OverrideState {
  outcome: 'promoted' | 'graduated';
  /** Only meaningful (and required before submit) when outcome === 'promoted' —
   * a custom target section within the batch's next class, instead of the
   * batch-wide default. */
  targetSectionId?: string;
}

interface BulkPromoteDialogProps {
  section: Section | null;
  promotedSectionOptions: { value: string; label: string }[];
  onOpenChange: (open: boolean) => void;
}

const BulkPromoteDialog = ({
  section,
  promotedSectionOptions,
  onOpenChange,
}: BulkPromoteDialogProps) => {
  const sectionId = section?.id ?? '';
  const { data: roster, isLoading: rosterLoading, isError: rosterError } = useSectionRoster(sectionId);
  const bulkPromote = useBulkPromoteSection(sectionId);

  const [defaultTargetSectionId, setDefaultTargetSectionId] = useState('');
  const [overrides, setOverrides] = useState<Record<string, OverrideState>>({});
  const [results, setResults] = useState<BulkPromoteResult[] | null>(null);
  const [search, setSearch] = useState('');

  // Reset local state whenever a different section is opened (or the dialog closes).
  useEffect(() => {
    setDefaultTargetSectionId('');
    setOverrides({});
    setResults(null);
    setSearch('');
    bulkPromote.reset();
    // Only re-run when switching sections — bulkPromote itself is intentionally
    // excluded, since including it would re-fire this effect on every mutation
    // state change (isPending/error) rather than only on section switches.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [sectionId]);

  const setOverrideOutcome = (studentId: string, value: string) => {
    setOverrides((prev) => {
      const next = { ...prev };
      if (value === 'default') {
        delete next[studentId];
      } else if (value === 'custom') {
        // Keep a previously chosen target section if the admin flips back to
        // 'custom' after trying something else.
        next[studentId] = { outcome: 'promoted', targetSectionId: next[studentId]?.targetSectionId };
      } else {
        next[studentId] = { outcome: 'graduated' };
      }
      return next;
    });
  };

  const overrideSelectValue = (studentId: string): string => {
    const o = overrides[studentId];
    if (!o) return 'default';
    return o.outcome === 'graduated' ? 'graduated' : 'custom';
  };

  const setOverrideTargetSection = (studentId: string, targetSectionId: string) => {
    setOverrides((prev) => {
      const existing = prev[studentId];
      if (!existing) return prev;
      return { ...prev, [studentId]: { ...existing, targetSectionId } };
    });
  };

  const hasIncompleteCustomOverride = Object.values(overrides).some(
    (o) => o.outcome === 'promoted' && !o.targetSectionId,
  );

  const submit = async () => {
    if (!section) return;
    const payload = {
      defaultTargetSectionId,
      overrides: Object.entries(overrides).map(([studentId, o]) => ({
        studentId,
        outcome: o.outcome,
        targetSectionId: o.outcome === 'promoted' ? o.targetSectionId : undefined,
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

  const q = search.toLowerCase().trim();
  const filteredRoster = q
    ? (roster ?? []).filter((entry) => entry.student.name.toLowerCase().includes(q))
    : (roster ?? []);

  return (
    <Dialog
      open={Boolean(section)}
      onOpenChange={onOpenChange}
      title={`Promote all — ${section?.name ?? ''}`}
      description="Applies to every student currently placed in this section, into the same batch's next class. Override individual students below before submitting."
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
                    : 'No next-class section exists for this batch yet'
                }
              />
            </Field>

            {roster.length > 5 ? (
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-subtle" />
                <Input
                  placeholder="Search students…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8"
                />
              </div>
            ) : null}

            <div className="flex max-h-[360px] flex-col gap-2 overflow-y-auto pr-1">
              {filteredRoster.length === 0 ? (
                <p className="py-2 text-center text-sm text-muted">No students match "{search}"</p>
              ) : (
                filteredRoster.map((entry) => {
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
                        {override?.outcome === 'promoted' ? (
                          <div className="w-44">
                            <Select
                              options={promotedSectionOptions}
                              value={override.targetSectionId ?? ''}
                              onValueChange={(value) => setOverrideTargetSection(entry.student.id, value)}
                              placeholder="Target section"
                              invalid={!override.targetSectionId}
                            />
                          </div>
                        ) : null}
                        <div className="w-48">
                          <Select
                            options={outcomeOverrideOptions}
                            value={overrideSelectValue(entry.student.id)}
                            onValueChange={(value) => setOverrideOutcome(entry.student.id, value)}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
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
              disabled={!defaultTargetSectionId || hasIncompleteCustomOverride}
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
