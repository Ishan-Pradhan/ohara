import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { BookOpen, Check, Flag, MapPin, Plus } from 'lucide-react';

import { useStudentFlags, useResolveFlag } from '../../features/teacher/useTeacher.js';

import {
  useClassMemberships,
  useCreateClassMembership,
  useCreateEnrollment,
  useSetClassMembershipOutcome,
  useStudentPlacement,
  useTransferClassMembership,
} from '../../features/placement/usePlacement.js';
import {
  outcomeSchema,
  transferSchema,
  type OutcomeInput,
  type TransferInput,
} from '../../features/placement/placement.schema.js';
import {
  useAcademicYears,
  useBatches,
  useClasses,
  useCourses,
  useSections,
} from '../../features/institution/useInstitution.js';
import type { Batch, Class, Section } from '../../features/institution/institution.schema.js';
import { ApiError } from '../../lib/apiError.js';
import { toast } from '../../lib/toast.js';
import { AppShell } from '../../components/layout/AppShell.js';
import { PageHeader } from '../../components/layout/PageHeader.js';
import { Card } from '../../components/ui/Card.js';
import { Badge } from '../../components/ui/Badge.js';
import { Button } from '../../components/ui/Button.js';
import { Field } from '../../components/ui/Field.js';
import { Select } from '../../components/ui/Select.js';
import { Skeleton } from '../../components/ui/Skeleton.js';
import { EmptyState } from '../../components/ui/EmptyState.js';
import { Dialog } from '../../components/ui/Dialog.js';
import { Alert } from '../../components/ui/Alert.js';

export const StudentDetailPage = () => {
  const { studentId = '' } = useParams();
  const { data: placement, isLoading, isError } = useStudentPlacement(studentId);
  const { data: memberships } = useClassMemberships(studentId);
  const { data: sections } = useSections();
  const { data: courses } = useCourses();

  // The combined placement view is scoped to the current year but doesn't
  // expose the underlying class_membership row id — transfer/outcome need
  // that id, so find it in the (already-fetched) full membership list by
  // matching the year the placement view is itself scoped to.
  const currentMembership = memberships?.find(
    (m) => m.academicYearId === placement?.academicYear?.id,
  );

  const [placeOpen, setPlaceOpen] = useState(false);
  const [enrollOpen, setEnrollOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [outcomeOpen, setOutcomeOpen] = useState(false);

  const createMembership = useCreateClassMembership(studentId);
  const createEnrollment = useCreateEnrollment(studentId);
  const transfer = useTransferClassMembership(studentId);
  const setOutcome = useSetClassMembershipOutcome(studentId);

  const { data: classes } = useClasses();
  const { data: years } = useAcademicYears();
  const { data: batches } = useBatches();

  const sectionOptions = (sections ?? []).map((s) => {
    const className = classes?.find((c) => c.id === s.classId)?.name ?? '—';
    const yearName = years?.find((y) => y.id === s.academicYearId)?.name ?? '—';
    const fill = s.capacity !== null ? `${s.enrolledCount}/${s.capacity}` : `${s.enrolledCount}`;
    return { value: s.id, label: `${className} — ${s.name} (${yearName}) · ${fill}` };
  });
  const enrolledCourseIds = new Set((placement?.courses ?? []).map((c) => c.id));
  const enrollableCourseOptions = (courses ?? [])
    .filter(
      (c) =>
        !enrolledCourseIds.has(c.id) &&
        c.classId === placement?.class?.id &&
        c.courseType === 'elective',
    )
    .map((c) => ({ value: c.id, label: c.title }));

  const currentClassForOutcome = classes?.find((c) => c.id === placement?.class?.id);
  const promotedSectionOptions = sectionOptions.filter((o) => {
    const section = sections?.find((s) => s.id === o.value);
    const cls = classes?.find((c) => c.id === section?.classId);
    return (
      cls &&
      currentClassForOutcome &&
      cls.programId === currentClassForOutcome.programId &&
      cls.orderIndex === currentClassForOutcome.orderIndex + 1
    );
  });
  const retainedSectionOptions = sectionOptions.filter((o) => {
    const section = sections?.find((s) => s.id === o.value);
    return section?.classId === currentClassForOutcome?.id;
  });

  const notPlaced = isError;

  return (
    <AppShell>
      <PageHeader title="Student placement" description="Current program, class, section, and enrolled courses." />

      {isLoading ? (
        <Skeleton className="h-48 w-full" />
      ) : notPlaced && (!sections || sections.length === 0) ? (
        <EmptyState
          icon={MapPin}
          title="No sections exist yet"
          description="Create a program, class, and section before placing students."
          action={
            <Link
              to="/admin/structure"
              className="inline-flex items-center justify-center gap-2 rounded-control bg-primary px-4 py-2.5 text-sm font-medium text-primary-fg hover:bg-primary-hover"
            >
              Go to Structure
            </Link>
          }
        />
      ) : notPlaced ? (
        <EmptyState
          icon={MapPin}
          title="Not placed for the current academic year"
          description="Place this student into a section to enroll them in courses."
          action={<Button onClick={() => setPlaceOpen(true)}>Place into section</Button>}
        />
      ) : placement ? (
        <div className="flex flex-col gap-6">
          <Card>
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div className="grid grid-cols-2 gap-x-8 gap-y-3 sm:grid-cols-4">
                <div>
                  <p className="text-xs text-subtle">Program</p>
                  <p className="text-sm font-medium text-fg">{placement.program?.name ?? '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-subtle">Class</p>
                  <p className="text-sm font-medium text-fg">{placement.class?.name ?? '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-subtle">Section</p>
                  <p className="text-sm font-medium text-fg">{placement.section?.name ?? '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-subtle">Academic year</p>
                  <p className="text-sm font-medium text-fg">{placement.academicYear?.name ?? '—'}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={!currentMembership}
                  onClick={() => setTransferOpen(true)}
                >
                  Transfer
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={!currentMembership}
                  onClick={() => setOutcomeOpen(true)}
                >
                  Promote / retain / graduate
                </Button>
              </div>
            </div>
          </Card>

          <div>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-semibold text-fg">Enrolled courses</h2>
              <Button size="sm" onClick={() => setEnrollOpen(true)}>
                <Plus className="size-4" aria-hidden />
                Add elective
              </Button>
            </div>
            {placement.courses.length === 0 ? (
              <EmptyState icon={BookOpen} title="Not enrolled in any courses yet" />
            ) : (
              <div className="flex flex-col gap-2">
                {placement.courses.map((course) => (
                  <Card key={course.id} padding="sm" className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-fg">{course.title}</p>
                      <p className="text-xs text-muted">{course.code}</p>
                    </div>
                    <div className="flex -space-x-2">
                      {course.teachers.length === 0 ? (
                        <Badge>No teacher assigned</Badge>
                      ) : (
                        course.teachers.map((teacher) => (
                          <Badge key={teacher.id} variant="primary">
                            {teacher.name}
                          </Badge>
                        ))
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>

          <FlagsCard studentId={studentId} />

          {memberships && memberships.length > 1 ? (
            <div>
              <h2 className="mb-3 text-base font-semibold text-fg">Promotion history</h2>
              <div className="flex flex-col gap-2">
                {memberships
                  .slice()
                  .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
                  .map((membership) => (
                    <Card key={membership.id} padding="sm" className="flex items-center justify-between">
                      <span className="text-sm text-muted">
                        {new Date(membership.createdAt).toLocaleDateString()}
                      </span>
                      <Badge
                        variant={
                          membership.outcome === 'graduated'
                            ? 'accent'
                            : membership.outcome === 'promoted'
                              ? 'success'
                              : membership.outcome === 'retained'
                                ? 'warning'
                                : 'neutral'
                        }
                      >
                        {membership.outcome}
                      </Badge>
                    </Card>
                  ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {/* Place into section (shown when not yet placed) */}
      <PlaceDialog
        open={placeOpen}
        onOpenChange={setPlaceOpen}
        sectionOptions={sectionOptions}
        sections={sections ?? []}
        classes={classes ?? []}
        batches={batches ?? []}
        onSubmit={async ({ sectionId, batchId }) => {
          await createMembership.mutateAsync({ sectionId, batchId });
          toast.success('Student placed');
          setPlaceOpen(false);
        }}
        loading={createMembership.isPending}
        error={createMembership.error}
      />

      {/* Enroll in a course */}
      <EnrollDialog
        open={enrollOpen}
        onOpenChange={setEnrollOpen}
        courseOptions={enrollableCourseOptions}
        onSubmit={async (courseId) => {
          await createEnrollment.mutateAsync(courseId);
          toast.success('Enrolled');
          setEnrollOpen(false);
        }}
        loading={createEnrollment.isPending}
        error={createEnrollment.error}
      />

      {/* Transfer to another section (same class) */}
      {currentMembership && placement?.section ? (
        <TransferDialog
          open={transferOpen}
          onOpenChange={setTransferOpen}
          sectionOptions={sectionOptions.filter((o) => o.value !== placement.section?.id)}
          onSubmit={async (input) => {
            await transfer.mutateAsync({ membershipId: currentMembership.id, input });
            toast.success('Student transferred');
            setTransferOpen(false);
          }}
          loading={transfer.isPending}
          error={transfer.error}
        />
      ) : null}

      {/* Promote / retain / graduate */}
      {currentMembership ? (
        <OutcomeDialog
          open={outcomeOpen}
          onOpenChange={setOutcomeOpen}
          promotedSectionOptions={promotedSectionOptions}
          retainedSectionOptions={retainedSectionOptions}
          onSubmit={async (input) => {
            await setOutcome.mutateAsync({ membershipId: currentMembership.id, input });
            toast.success('Outcome recorded');
            setOutcomeOpen(false);
          }}
          loading={setOutcome.isPending}
          error={setOutcome.error}
        />
      ) : null}
    </AppShell>
  );
};

interface PlaceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sectionOptions: { value: string; label: string }[];
  sections: Section[];
  classes: Class[];
  batches: Batch[];
  onSubmit: (input: { sectionId: string; batchId: string }) => Promise<void>;
  loading: boolean;
  error: unknown;
}

const PlaceDialog = ({
  open,
  onOpenChange,
  sectionOptions,
  sections,
  classes,
  batches,
  onSubmit,
  loading,
  error,
}: PlaceDialogProps) => {
  const [sectionId, setSectionId] = useState('');
  const [batchId, setBatchId] = useState('');

  const selectedProgramId = classes.find(
    (c) => c.id === sections.find((s) => s.id === sectionId)?.classId,
  )?.programId;
  const batchOptions = batches
    .filter((b) => b.programId === selectedProgramId)
    .map((b) => ({ value: b.id, label: b.name }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="Place into section">
      <div className="flex flex-col gap-4">
        {error instanceof ApiError ? <Alert>{error.message}</Alert> : null}
        <Field label="Section" htmlFor="place-section">
          <Select
            id="place-section"
            options={sectionOptions}
            value={sectionId}
            onValueChange={(value) => {
              setSectionId(value);
              setBatchId('');
            }}
            placeholder="Select a section"
          />
        </Field>
        <Field label="Batch" htmlFor="place-batch">
          <Select
            id="place-batch"
            options={batchOptions}
            value={batchId}
            onValueChange={setBatchId}
            placeholder={
              !sectionId
                ? 'Choose a section first'
                : batchOptions.length
                  ? 'Select a batch'
                  : 'No batches for this program'
            }
          />
        </Field>
        <div className="mt-2 flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            loading={loading}
            disabled={!sectionId || !batchId}
            onClick={() => onSubmit({ sectionId, batchId })}
          >
            Place
          </Button>
        </div>
      </div>
    </Dialog>
  );
};

interface EnrollDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  courseOptions: { value: string; label: string }[];
  onSubmit: (courseId: string) => Promise<void>;
  loading: boolean;
  error: unknown;
}

const EnrollDialog = ({ open, onOpenChange, courseOptions, onSubmit, loading, error }: EnrollDialogProps) => {
  const [courseId, setCourseId] = useState('');

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="Choose an elective">
      <div className="flex flex-col gap-4">
        {error instanceof ApiError ? <Alert>{error.message}</Alert> : null}
        <Field label="Elective course" htmlFor="enroll-course">
          <Select
            id="enroll-course"
            options={courseOptions}
            value={courseId}
            onValueChange={setCourseId}
            placeholder={courseOptions.length ? 'Select an elective' : 'No electives available for this class'}
          />
        </Field>
        <div className="mt-2 flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" loading={loading} disabled={!courseId} onClick={() => onSubmit(courseId)}>
            Enroll
          </Button>
        </div>
      </div>
    </Dialog>
  );
};

interface TransferDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sectionOptions: { value: string; label: string }[];
  onSubmit: (input: TransferInput) => Promise<void>;
  loading: boolean;
  error: unknown;
}

const TransferDialog = ({ open, onOpenChange, sectionOptions, onSubmit, loading, error }: TransferDialogProps) => {
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<TransferInput>({ resolver: zodResolver(transferSchema) });

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="Transfer to another section" description="Same-class transfers only, for now.">
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
        {error instanceof ApiError ? <Alert>{error.message}</Alert> : null}
        <Field label="Target section" htmlFor="targetSectionId" error={errors.targetSectionId?.message}>
          <Controller
            control={control}
            name="targetSectionId"
            render={({ field }) => (
              <Select
                id="targetSectionId"
                options={sectionOptions}
                value={field.value}
                onValueChange={field.onChange}
                placeholder="Select a section"
              />
            )}
          />
        </Field>
        <div className="mt-2 flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" loading={loading}>
            Transfer
          </Button>
        </div>
      </form>
    </Dialog>
  );
};

interface OutcomeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  promotedSectionOptions: { value: string; label: string }[];
  retainedSectionOptions: { value: string; label: string }[];
  onSubmit: (input: OutcomeInput) => Promise<void>;
  loading: boolean;
  error: unknown;
}

const outcomeOptions = [
  { value: 'promoted', label: 'Promoted' },
  { value: 'retained', label: 'Retained' },
  { value: 'graduated', label: 'Graduated' },
];

const OutcomeDialog = ({
  open,
  onOpenChange,
  promotedSectionOptions,
  retainedSectionOptions,
  onSubmit,
  loading,
  error,
}: OutcomeDialogProps) => {
  const {
    control,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<OutcomeInput>({ resolver: zodResolver(outcomeSchema) });

  const outcome = watch('outcome');
  const sectionOptions = outcome === 'promoted' ? promotedSectionOptions : retainedSectionOptions;

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Record end-of-year outcome"
      description="Creates a new placement for the current academic year, unless the student is graduating."
    >
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
        {error instanceof ApiError ? <Alert>{error.message}</Alert> : null}
        <Field label="Outcome" htmlFor="outcome" error={errors.outcome?.message}>
          <Controller
            control={control}
            name="outcome"
            render={({ field }) => (
              <Select
                id="outcome"
                options={outcomeOptions}
                value={field.value}
                onValueChange={field.onChange}
                placeholder="Select an outcome"
              />
            )}
          />
        </Field>
        {outcome && outcome !== 'graduated' ? (
          <Field label="Target section" htmlFor="targetSectionId" error={errors.targetSectionId?.message}>
            <Controller
              control={control}
              name="targetSectionId"
              render={({ field }) => (
                <Select
                  id="targetSectionId"
                  options={sectionOptions}
                  value={field.value}
                  onValueChange={field.onChange}
                  placeholder="Select a section"
                />
              )}
            />
          </Field>
        ) : null}
        <div className="mt-2 flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" loading={loading}>
            Save outcome
          </Button>
        </div>
      </form>
    </Dialog>
  );
};

const FlagsCard = ({ studentId }: { studentId: string }) => {
  const { data: flags, isLoading } = useStudentFlags(studentId);
  const resolveFlag = useResolveFlag(studentId);

  if (isLoading) {
    return <Skeleton className="h-16 w-full" />;
  }

  const openFlags = (flags ?? []).filter((f) => f.status === 'open');
  if (openFlags.length === 0) {
    return null;
  }

  return (
    <div>
      <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-fg">
        <Flag className="size-4 text-warning" aria-hidden />
        Flagged by a teacher
      </h2>
      <div className="flex flex-col gap-2">
        {openFlags.map((flag) => (
          <Card key={flag.id} padding="sm" className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm text-fg">{flag.reason}</p>
              <p className="mt-0.5 text-xs text-muted">
                {flag.raisedByName ?? 'A teacher'} · {new Date(flag.createdAt).toLocaleDateString()}
              </p>
            </div>
            <Button
              size="sm"
              variant="secondary"
              loading={resolveFlag.isPending}
              onClick={() => resolveFlag.mutate(flag.id)}
            >
              <Check className="size-4" aria-hidden />
              Resolve
            </Button>
          </Card>
        ))}
      </div>
    </div>
  );
};
