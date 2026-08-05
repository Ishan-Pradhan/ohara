import { Link } from 'react-router-dom';
import { Check, ChevronRight, ClipboardList, GraduationCap, Layers, School, UserCog } from 'lucide-react';

import {
  useAcademicYears,
  useBatches,
  useClasses,
  useCourses,
  useInstitutionProfile,
  usePrograms,
  useSections,
} from '../features/institution/useInstitution.js';
import { useUsers } from '../features/users/useUsers.js';
import { Card } from '../components/ui/Card.js';
import { Skeleton } from '../components/ui/Skeleton.js';
import { cn } from '../lib/cn.js';

interface ChecklistStep {
  label: string;
  done: boolean;
  to: string;
}

export const SetupChecklist = () => {
  const { data: profile, isLoading: profileLoading } = useInstitutionProfile();
  const { data: programs, isLoading: programsLoading } = usePrograms();
  const { data: classes, isLoading: classesLoading } = useClasses();
  const { data: years, isLoading: yearsLoading } = useAcademicYears();
  const { data: batches, isLoading: batchesLoading } = useBatches();
  const { data: sections, isLoading: sectionsLoading } = useSections();
  const { data: courses, isLoading: coursesLoading } = useCourses();
  const { data: staff, isLoading: staffLoading } = useUsers({ role: 'teacher', limit: 1 });

  const isLoading =
    profileLoading ||
    programsLoading ||
    classesLoading ||
    yearsLoading ||
    batchesLoading ||
    sectionsLoading ||
    coursesLoading ||
    staffLoading;

  if (isLoading) {
    return <Skeleton className="h-64 w-full" />;
  }

  const firstClass = classes?.[0];

  const steps: ChecklistStep[] = [
    { label: 'Set your institution profile', done: Boolean(profile), to: '/admin/settings' },
    { label: 'Create your first program', done: (programs?.length ?? 0) > 0, to: '/admin/structure' },
    {
      label: 'Add a class',
      done: (classes?.length ?? 0) > 0,
      to: programs?.[0] ? `/admin/structure/${programs[0].id}` : '/admin/structure',
    },
    {
      label: 'Set the current academic year',
      done: (years ?? []).some((y) => y.isCurrent),
      to: '/admin/academic-years',
    },
    {
      label: 'Create a batch',
      done: (batches?.length ?? 0) > 0,
      to: programs?.[0] ? `/admin/structure/${programs[0].id}` : '/admin/structure',
    },
    {
      label: 'Add a section',
      done: (sections?.length ?? 0) > 0,
      to: firstClass ? `/admin/structure/${firstClass.programId}/${firstClass.id}` : '/admin/structure',
    },
    {
      label: 'Add a course',
      done: (courses?.length ?? 0) > 0,
      to: firstClass ? `/admin/structure/${firstClass.programId}/${firstClass.id}` : '/admin/structure',
    },
  ];

  const allDone = steps.every((step) => step.done);

  if (allDone) {
    return (
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard icon={School} label="Programs" count={programs?.length ?? 0} />
        <StatCard icon={Layers} label="Classes" count={classes?.length ?? 0} />
        <StatCard icon={GraduationCap} label="Courses" count={courses?.length ?? 0} />
        <StatCard icon={UserCog} label="Staff" count={staff?.meta.totalItems ?? 0} />
      </div>
    );
  }

  return (
    <Card>
      <div className="mb-4 flex items-start gap-4">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary-soft">
          <ClipboardList className="size-5.5 text-primary" aria-hidden />
        </div>
        <div>
          <h2 className="text-base font-semibold text-fg">Get your institution set up</h2>
          <p className="mt-1 text-sm text-muted">Do these in order — each one builds on the last.</p>
        </div>
      </div>

      <ul className="flex flex-col gap-1">
        {steps.map((step, index) => (
          <li key={step.label}>
            <Link
              to={step.to}
              className="flex items-center justify-between gap-3 rounded-control px-3 py-2.5 transition-colors hover:bg-surface-hover"
            >
              <span className="flex items-center gap-3">
                <span
                  className={cn(
                    'flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
                    step.done ? 'bg-success-soft text-success' : 'bg-surface-hover text-subtle',
                  )}
                >
                  {step.done ? <Check className="size-3.5" aria-hidden /> : index + 1}
                </span>
                <span
                  className={cn(
                    'text-sm',
                    step.done ? 'text-muted line-through' : 'font-medium text-fg',
                  )}
                >
                  {step.label}
                </span>
              </span>
              <ChevronRight className="size-4 text-subtle" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
};

const StatCard = ({
  icon: Icon,
  label,
  count,
}: {
  icon: typeof School;
  label: string;
  count: number;
}) => (
  <Card padding="sm" className="flex items-center gap-3">
    <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-soft">
      <Icon className="size-4.5 text-primary" aria-hidden />
    </div>
    <div>
      <p className="text-lg font-semibold text-fg">{count}</p>
      <p className="text-xs text-muted">{label}</p>
    </div>
  </Card>
);
