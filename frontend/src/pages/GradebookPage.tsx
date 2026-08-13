import { useState, useEffect } from 'react';
import { BarChart3 } from 'lucide-react';

import { useCurrentUser } from '../features/auth/useAuth.js';
import { useAccessibleCourses } from '../features/courses/useAccessibleCourses.js';
import { useMyCourses } from '../features/teacher/useTeacher.js';
import { useCourseBatches } from '../features/courseContent/useCourseContent.js';
import {
  usePrograms,
  useClasses,
  useBatches,
  useBatchCurrentPlacement,
  useSections,
  useCourses,
} from '../features/institution/useInstitution.js';
import { AppShell } from '../components/layout/AppShell.js';
import { PageHeader } from '../components/layout/PageHeader.js';
import { CourseSwitcher } from '../components/CourseSwitcher.js';
import { TeacherCourseNav } from '../components/TeacherCourseNav.js';
import { Select } from '../components/ui/Select.js';
import { Skeleton } from '../components/ui/Skeleton.js';
import { EmptyState } from '../components/ui/EmptyState.js';
import { GradebookSection } from './admin/course-content/GradebookSection.js';
import { StudentGradesSection } from './student/StudentGradesSection.js';

export const GradebookPage = () => {
  const { data: user } = useCurrentUser();

  if (user?.role === 'student') return <StudentGradebookView />;
  if (user?.role === 'admin') return <AdminGradebookView />;
  return <TeacherGradebookView />;
};

/** Admin view: Program → Batch → Semester → Section → Course → Gradebook */
const AdminGradebookView = () => {
  const { data: programs, isLoading: programsLoading } = usePrograms();
  const { data: allCourses } = useCourses();

  const [programId, setProgramId] = useState('');
  const [batchId, setBatchId] = useState('');
  const [classId, setClassId] = useState('');
  const [sectionId, setSectionId] = useState('');
  const [courseId, setCourseId] = useState('');

  const { data: batches } = useBatches(programId || undefined);
  // The full semester history for this batch, not just its current one —
  // browsing past semesters (old grades) is a real need.
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

  // Sections are already scoped to this one (classId, batchId) pair, and
  // (classId, batchId, name) is unique — no more same-named sections to
  // disambiguate by year, unlike the old academic-year-keyed model.
  const sectionOptions = (sectionsForClass ?? [])
    .slice()
    .sort((a, b) => {
      const aCurrent = currentSectionIds.has(a.id) ? 1 : 0;
      const bCurrent = currentSectionIds.has(b.id) ? 1 : 0;
      if (aCurrent !== bCurrent) return bCurrent - aCurrent;
      return b.enrolledCount - a.enrolledCount;
    })
    .map((s) => {
      const labelParts = [`Section ${s.name}`];
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
        <PageHeader title="Gradebook" description="Every assignment and quiz score, by course." />
        <Skeleton className="h-64 w-full" />
      </AppShell>
    );
  }

  if (!programs || programs.length === 0) {
    return (
      <AppShell>
        <PageHeader title="Gradebook" description="Every assignment and quiz score, by course." />
        <EmptyState
          icon={BarChart3}
          title="No programs yet"
          description="Set up programs and classes before viewing the gradebook."
        />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <PageHeader title="Gradebook" description="Select program, batch, semester, section, and course to view grades." />

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

        {/* Gradebook — batchId is always whichever batch the picker above has
            selected, current or past, so this always shows exactly what was
            picked instead of silently falling back to "whoever's current." */}
        {courseId ? (
          <GradebookSection courseId={courseId} batchId={batchId || undefined} />
        ) : (
          <EmptyState
            icon={BarChart3}
            title="Choose selections above"
            description="Select a program, semester, batch, section, and course to view grades."
          />
        )}
      </div>
    </AppShell>
  );
};

/** Teacher view: course switcher with program/batch context, plus a batch
 * dropdown (shown only once a course has more than one batch in its
 * history) for viewing a past batch's gradebook instead of the current one. */
const TeacherGradebookView = () => {
  const { data: courses, isLoading } = useMyCourses();
  const [courseId, setCourseId] = useState('');
  const [batchId, setBatchId] = useState('');

  const { data: courseBatches } = useCourseBatches(courseId);
  const batchOptions = (courseBatches ?? []).map((b) => ({ value: b.id, label: b.name }));

  const onSelectCourse = (id: string) => {
    setCourseId(id);
    setBatchId('');
  };

  return (
    <AppShell>
      <PageHeader title="Gradebook" description="Every assignment and quiz score, by course." />

      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : !courses || courses.length === 0 ? (
        <EmptyState icon={BarChart3} title="No courses yet" description="Grades will appear here once you have a course." />
      ) : (
        <div className="flex flex-col gap-4">
          <TeacherCourseNav courses={courses} onSelect={onSelectCourse} />

          {courseId && batchOptions.length > 1 ? (
            <div className="flex flex-col gap-1.5 sm:w-56">
              <label className="text-xs font-medium text-muted uppercase tracking-wide">Batch</label>
              <Select
                value={batchId}
                onValueChange={setBatchId}
                options={batchOptions}
                placeholder="Current batch"
              />
            </div>
          ) : null}

          {courseId ? <GradebookSection courseId={courseId} batchId={batchId || undefined} /> : null}
        </div>
      )}
    </AppShell>
  );
};

/** Student view: course switcher */
const StudentGradebookView = () => {
  const { courses, isLoading } = useAccessibleCourses();
  const [courseId, setCourseId] = useState('');

  useEffect(() => {
    if (!courseId && courses.length > 0) setCourseId(courses[0]!.id);
  }, [courses, courseId]);

  return (
    <AppShell>
      <PageHeader title="Gradebook" description="Every assignment and quiz score, by course." />

      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : courses.length === 0 ? (
        <EmptyState icon={BarChart3} title="No courses yet" description="Grades will appear here once you have a course." />
      ) : (
        <div className="flex flex-col gap-4">
          <CourseSwitcher courses={courses} selectedCourseId={courseId} onSelect={setCourseId} />
          {courseId ? <StudentGradesSection courseId={courseId} /> : null}
        </div>
      )}
    </AppShell>
  );
};
