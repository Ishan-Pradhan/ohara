import { useState, useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';

import { useCurrentUser } from '../features/auth/useAuth.js';
import { useMyCourses } from '../features/teacher/useTeacher.js';
import {
  usePrograms,
  useClasses,
  useBatches,
  useBatchCurrentPlacement,
  useSections,
  useCourses,
  useAcademicYears,
} from '../features/institution/useInstitution.js';
import { AppShell } from '../components/layout/AppShell.js';
import { PageHeader } from '../components/layout/PageHeader.js';
import { TeacherCourseNav } from '../components/TeacherCourseNav.js';
import { Select } from '../components/ui/Select.js';
import { Skeleton } from '../components/ui/Skeleton.js';
import { EmptyState } from '../components/ui/EmptyState.js';
import { AtRiskSection } from './admin/course-content/AtRiskSection.js';

export const AtRiskPage = () => {
  const { data: user } = useCurrentUser();

  if (user?.role === 'student') return <StudentAtRiskView />;
  if (user?.role === 'admin') return <AdminAtRiskView />;
  return <TeacherAtRiskView />;
};

/** Admin view: Program → Batch → Semester → Section → Course → At-Risk */
const AdminAtRiskView = () => {
  const { data: programs, isLoading: programsLoading } = usePrograms();
  const { data: allCourses } = useCourses();
  const { data: academicYears } = useAcademicYears();

  const [programId, setProgramId] = useState('');
  const [batchId, setBatchId] = useState('');
  const [classId, setClassId] = useState('');
  const [sectionId, setSectionId] = useState('');
  const [courseId, setCourseId] = useState('');

  const { data: batches } = useBatches(programId || undefined);
  // The full semester history for this batch, not just its current one —
  // browsing past semesters (old at-risk flags) is a real need.
  // useBatchCurrentPlacement (below) is the separate signal for which of
  // these is current, used only for labeling (sorted first), never filtering.
  const { data: semesterOptions } = useClasses(batchId ? { programId: programId || undefined, batchId } : undefined);
  // Scoped server-side to this batch's actual placements across its full
  // history too — a batch with nothing ever placed in this class must show
  // zero sections here, never a different batch's real roster (see
  // docs/SCHEMA.md's `sections` entry for why).
  const { data: sectionsForClass } = useSections(
    classId ? { classId, batchId: batchId || undefined } : undefined,
  );
  const { data: currentPlacement } = useBatchCurrentPlacement(batchId);

  const yearById = new Map((academicYears ?? []).map((y) => [y.id, y]));
  const currentClassIds = new Set((currentPlacement ?? []).map((p) => p.classId));
  const currentSectionIds = new Set((currentPlacement ?? []).map((p) => p.sectionId));

  const filteredCourses = (allCourses ?? [])
    .filter((c) => c.classId === classId)
    .map((c) => ({ id: c.id, title: c.title, code: c.code }));

  const batchOptions = (batches ?? []).map((b) => ({ value: b.id, label: b.name }));
  const programOptions = (programs ?? []).map((p) => ({ value: p.id, label: p.name }));
  // Current semester sorts first and is labeled, so it's easy to spot —
  // nothing is auto-selected, the admin still has to pick it explicitly.
  const classOptions = (semesterOptions ?? [])
    .slice()
    .sort((a, b) => {
      const aCurrent = currentClassIds.has(a.id) ? 1 : 0;
      const bCurrent = currentClassIds.has(b.id) ? 1 : 0;
      if (aCurrent !== bCurrent) return bCurrent - aCurrent;
      return a.orderIndex - b.orderIndex;
    })
    .map((c) => ({ value: c.id, label: currentClassIds.has(c.id) ? `${c.name} (current)` : c.name }));

  // A retained batch that repeated a semester shows up as two sections for
  // the same class (one per academic-year attempt) — only then is the year
  // worth showing, since batch and semester are already fixed by this point.
  const sectionNameCounts = new Map<string, number>();
  for (const s of sectionsForClass ?? []) {
    sectionNameCounts.set(s.name, (sectionNameCounts.get(s.name) ?? 0) + 1);
  }
  const sectionOptions = (sectionsForClass ?? [])
    .slice()
    .sort((a, b) => {
      const aCurrent = currentSectionIds.has(a.id) ? 1 : 0;
      const bCurrent = currentSectionIds.has(b.id) ? 1 : 0;
      if (aCurrent !== bCurrent) return bCurrent - aCurrent;
      if (a.enrolledCount !== b.enrolledCount) return b.enrolledCount - a.enrolledCount;
      const aYear = yearById.get(a.academicYearId)?.startDate ?? '';
      const bYear = yearById.get(b.academicYearId)?.startDate ?? '';
      return bYear.localeCompare(aYear);
    })
    .map((s) => {
      const labelParts = [`Section ${s.name}`];
      if ((sectionNameCounts.get(s.name) ?? 0) > 1) {
        const yearName = yearById.get(s.academicYearId)?.name;
        if (yearName) labelParts.push(yearName);
      }
      if (currentSectionIds.has(s.id)) labelParts.push('current');
      const headcount = s.enrolledCount > 0 ? `${s.enrolledCount} students` : 'empty';
      return { value: s.id, label: `${labelParts.join(' — ')} (${headcount})` };
    });

  // Nothing here auto-selects — the admin picks every level explicitly, and
  // data only loads once they have. Only clearing dependent selections when
  // a parent changes (so a stale child selection can't linger) stays.
  useEffect(() => { setBatchId(''); setClassId(''); setSectionId(''); setCourseId(''); }, [programId]);
  useEffect(() => { setClassId(''); setSectionId(''); setCourseId(''); }, [batchId]);
  useEffect(() => { setSectionId(''); setCourseId(''); }, [classId]);
  useEffect(() => { setCourseId(''); }, [sectionId]);

  if (programsLoading) {
    return (
      <AppShell>
        <PageHeader title="At-Risk Students" description="Students flagged from grades, attendance, and missed work." />
        <Skeleton className="h-64 w-full" />
      </AppShell>
    );
  }

  if (!programs || programs.length === 0) {
    return (
      <AppShell>
        <PageHeader title="At-Risk Students" description="Students flagged from grades, attendance, and missed work." />
        <EmptyState
          icon={AlertTriangle}
          title="No programs yet"
          description="Set up programs and classes before viewing at-risk students."
        />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <PageHeader title="At-Risk Students" description="Select program, batch, semester, section, and course to view at-risk flags." />

      <div className="flex flex-col gap-6">
        {/* Cascading selectors */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted uppercase tracking-wide">Program</label>
            <Select
              value={programId}
              onValueChange={setProgramId}
              options={programOptions}
              placeholder="Select program…"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted uppercase tracking-wide">Batch</label>
            <Select
              value={batchId}
              onValueChange={setBatchId}
              options={batchOptions}
              placeholder={programId ? 'Select batch…' : 'Choose a program first'}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted uppercase tracking-wide">Semester</label>
            <Select
              value={classId}
              onValueChange={setClassId}
              options={classOptions}
              placeholder={batchId ? 'Select semester…' : 'Choose a batch first'}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted uppercase tracking-wide">Section</label>
            <Select
              value={sectionId}
              onValueChange={setSectionId}
              options={sectionOptions}
              placeholder={
                !classId
                  ? 'Choose a semester first'
                  : sectionOptions.length === 0
                    ? 'No students placed in this batch yet'
                    : 'Select section…'
              }
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted uppercase tracking-wide">Course</label>
            <Select
              value={courseId}
              onValueChange={setCourseId}
              options={filteredCourses.map((c) => ({ value: c.id, label: `${c.title} (${c.code})` }))}
              placeholder={classId ? 'Select course…' : 'Choose a semester first'}
            />
          </div>
        </div>

        {/* At-risk section */}
        {courseId ? (
          <AtRiskSection courseId={courseId} sectionId={sectionId || undefined} />
        ) : (
          <EmptyState
            icon={AlertTriangle}
            title="Choose selections above"
            description="Select a program, batch, semester, section, and course to view at-risk students."
          />
        )}
      </div>
    </AppShell>
  );
};

/** Teacher view: course switcher with program/batch context */
const TeacherAtRiskView = () => {
  const { data: courses, isLoading } = useMyCourses();
  const [courseId, setCourseId] = useState('');

  return (
    <AppShell>
      <PageHeader title="At-Risk Students" description="Students flagged from grades, attendance, and missed work, by course." />

      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : !courses || courses.length === 0 ? (
        <EmptyState icon={AlertTriangle} title="No courses yet" description="At-risk flags will appear here once you have a course." />
      ) : (
        <div className="flex flex-col gap-4">
          <TeacherCourseNav courses={courses} onSelect={setCourseId} />
          {courseId ? <AtRiskSection courseId={courseId} /> : null}
        </div>
      )}
    </AppShell>
  );
};

/** Student view: no at-risk for students — redirect or show empty */
const StudentAtRiskView = () => {
  return (
    <AppShell>
      <PageHeader title="At-Risk Students" description="Students flagged from grades, attendance, and missed work." />
      <EmptyState
        icon={AlertTriangle}
        title="Not available"
        description="This view is only available for teachers and administrators."
      />
    </AppShell>
  );
};
