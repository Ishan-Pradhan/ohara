import { useState, useEffect } from 'react';
import { BarChart3 } from 'lucide-react';

import { useCurrentUser } from '../features/auth/useAuth.js';
import { useAccessibleCourses } from '../features/courses/useAccessibleCourses.js';
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

        {/* Gradebook */}
        {courseId ? (
          <GradebookSection courseId={courseId} />
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

/** Teacher view: course switcher with program/batch context */
const TeacherGradebookView = () => {
  const { data: courses, isLoading } = useMyCourses();
  const [courseId, setCourseId] = useState('');

  useEffect(() => {
    if (!courseId && courses && courses.length > 0) setCourseId(courses[0]!.id);
  }, [courses, courseId]);

  return (
    <AppShell>
      <PageHeader title="Gradebook" description="Every assignment and quiz score, by course." />

      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : !courses || courses.length === 0 ? (
        <EmptyState icon={BarChart3} title="No courses yet" description="Grades will appear here once you have a course." />
      ) : (
        <div className="flex flex-col gap-4">
          <CourseSwitcher
            courses={courses.map((c) => ({ id: c.id, title: c.title, code: c.code }))}
            selectedCourseId={courseId}
            onSelect={setCourseId}
          />
          {courseId ? <GradebookSection courseId={courseId} /> : null}
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
