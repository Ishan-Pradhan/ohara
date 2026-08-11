import { useState, useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';

import { useCurrentUser } from '../features/auth/useAuth.js';
import { useMyCourses } from '../features/teacher/useTeacher.js';
import {
  usePrograms,
  useClasses,
  useBatches,
  useSections,
  useCourses,
} from '../features/institution/useInstitution.js';
import { AppShell } from '../components/layout/AppShell.js';
import { PageHeader } from '../components/layout/PageHeader.js';
import { CourseSwitcher } from '../components/CourseSwitcher.js';
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
  const { data: allSections } = useSections();
  const { data: allCourses } = useCourses();

  const [programId, setProgramId] = useState('');
  const [batchId, setBatchId] = useState('');
  const [classId, setClassId] = useState('');
  const [sectionId, setSectionId] = useState('');
  const [courseId, setCourseId] = useState('');

  const { data: batches } = useBatches(programId || undefined);
  const { data: semesterOptions } = useClasses(batchId ? { programId: programId || undefined, batchId } : undefined);

  const sectionOptions = (allSections ?? [])
    .filter((s) => s.classId === classId)
    .map((s) => ({ value: s.id, label: `Section ${s.name}` }));

  const filteredCourses = (allCourses ?? [])
    .filter((c) => c.classId === classId)
    .map((c) => ({ id: c.id, title: c.title, code: c.code }));

  const batchOptions = (batches ?? []).map((b) => ({ value: b.id, label: b.name }));
  const programOptions = (programs ?? []).map((p) => ({ value: p.id, label: p.name }));
  const classOptions = (semesterOptions ?? [])
    .sort((a, b) => a.orderIndex - b.orderIndex)
    .map((c) => ({ value: c.id, label: c.name }));

  useEffect(() => { setBatchId(''); setClassId(''); setSectionId(''); setCourseId(''); }, [programId]);
  useEffect(() => { setClassId(''); setSectionId(''); setCourseId(''); }, [batchId]);
  useEffect(() => { setSectionId(''); setCourseId(''); }, [classId]);
  useEffect(() => { setCourseId(''); }, [sectionId]);

  useEffect(() => {
    if (!courseId && filteredCourses.length > 0) setCourseId(filteredCourses[0]!.id);
  }, [courseId, filteredCourses]);

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
              placeholder={classId ? 'Select section…' : 'Choose a semester first'}
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

  useEffect(() => {
    if (!courseId && courses && courses.length > 0) setCourseId(courses[0]!.id);
  }, [courses, courseId]);

  return (
    <AppShell>
      <PageHeader title="At-Risk Students" description="Students flagged from grades, attendance, and missed work, by course." />

      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : !courses || courses.length === 0 ? (
        <EmptyState icon={AlertTriangle} title="No courses yet" description="At-risk flags will appear here once you have a course." />
      ) : (
        <div className="flex flex-col gap-4">
          <CourseSwitcher
            courses={courses.map((c) => ({ id: c.id, title: c.title, code: c.code }))}
            selectedCourseId={courseId}
            onSelect={setCourseId}
          />
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
