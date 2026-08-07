import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { GraduationCap } from 'lucide-react';

import { useCurrentUser } from '../features/auth/useAuth.js';
import { useAccessibleCourses } from '../features/courses/useAccessibleCourses.js';
import {
  usePrograms,
  useClasses,
  useBatches,
} from '../features/institution/useInstitution.js';
import { useExamTerms } from '../features/examMarks/useExamMarks.js';
import { AppShell } from '../components/layout/AppShell.js';
import { PageHeader } from '../components/layout/PageHeader.js';
import { CourseSwitcher } from '../components/CourseSwitcher.js';
import { Select } from '../components/ui/Select.js';
import { Skeleton } from '../components/ui/Skeleton.js';
import { EmptyState } from '../components/ui/EmptyState.js';
import { ExamMarksEntrySection } from './admin/course-content/ExamMarksEntrySection.js';
import { BulkExamMarksEntry } from './admin/course-content/BulkExamMarksEntry.js';
import { TranscriptView } from './TranscriptView.js';

/** Two very different audiences share this one nav entry:
 * - Admin: lands on a cascading workspace: Program → Semester → Batch → Exam Term → bulk grid.
 * - Teacher: course switcher (unchanged — teachers don't need full-cohort bulk entry).
 * - Student / ?studentId= view: compiled, read-only academic transcript ledger. */
export const TranscriptPage = () => {
  const { data: user } = useCurrentUser();
  const [searchParams] = useSearchParams();
  const viewingStudentId = searchParams.get('studentId');

  const isStudent = user?.role === 'student';
  const showLedgerFor = isStudent ? (user?.id ?? '') : viewingStudentId;

  if (showLedgerFor) {
    return (
      <AppShell>
        <PageHeader title="Academic Transcript" description="Exam marks grouped by semester, across every course." />
        <TranscriptView studentId={showLedgerFor} />
      </AppShell>
    );
  }

  if (user?.role === 'admin') {
    return <AdminBulkMarksWorkspace />;
  }

  return <TeacherMarksWorkspace />;
};

/** Admin view: Program → Semester (Class) → Batch → Exam Term → spreadsheet grid */
const AdminBulkMarksWorkspace = () => {
  const { data: programs, isLoading: programsLoading } = usePrograms();
  const { data: allClasses } = useClasses();

  const [programId, setProgramId] = useState('');
  const [classId, setClassId] = useState('');
  const [batchId, setBatchId] = useState('');
  const [examTermId, setExamTermId] = useState('');

  const { data: batches } = useBatches(programId || undefined);
  const { data: examTerms } = useExamTerms();

  // Filter classes to the selected program and sort by orderIndex
  const semesterOptions = (allClasses ?? [])
    .filter((c) => c.programId === programId)
    .sort((a, b) => a.orderIndex - b.orderIndex)
    .map((c) => ({ value: c.id, label: c.name }));

  const batchOptions = (batches ?? []).map((b) => ({ value: b.id, label: b.name }));
  const examTermOptions = (examTerms ?? []).map((t) => ({ value: t.id, label: t.name }));
  const programOptions = (programs ?? []).map((p) => ({ value: p.id, label: p.name }));

  // Reset downstream selections when parent changes
  useEffect(() => { setClassId(''); setBatchId(''); }, [programId]);
  useEffect(() => { setBatchId(''); }, [classId]);

  const ready = Boolean(classId && batchId && examTermId);

  return (
    <AppShell>
      <PageHeader
        title="Transcripts"
        description="Select program, semester, batch, and exam term to enter marks for the whole cohort."
      />

      {programsLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : !programs || programs.length === 0 ? (
        <EmptyState
          icon={GraduationCap}
          title="No programs yet"
          description="Set up programs and classes before entering exam marks."
        />
      ) : (
        <div className="flex flex-col gap-6">
          {/* Cascading selectors */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted uppercase tracking-wide">Program</label>
              <Select
                id="program-select"
                value={programId}
                onValueChange={setProgramId}
                options={programOptions}
                placeholder="Select program…"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted uppercase tracking-wide">Semester</label>
              <Select
                id="class-select"
                value={classId}
                onValueChange={setClassId}
                options={semesterOptions}
                placeholder={programId ? 'Select semester…' : 'Choose a program first'}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted uppercase tracking-wide">Batch</label>
              <Select
                id="batch-select"
                value={batchId}
                onValueChange={setBatchId}
                options={batchOptions}
                placeholder={programId ? 'Select batch…' : 'Choose a program first'}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted uppercase tracking-wide">Exam Term</label>
              <Select
                id="exam-term-select"
                value={examTermId}
                onValueChange={setExamTermId}
                options={examTermOptions}
                placeholder="Select exam term…"
              />
            </div>
          </div>

          {/* Grid */}
          {ready ? (
            <BulkExamMarksEntry classId={classId} batchId={batchId} examTermId={examTermId} />
          ) : (
            <EmptyState
              icon={GraduationCap}
              title="Choose selections above"
              description="Select a program, semester, batch, and exam term to view and edit marks for the entire cohort."
            />
          )}
        </div>
      )}
    </AppShell>
  );
};

/** Teacher view: course switcher (unchanged) */
const TeacherMarksWorkspace = () => {
  const { courses, isLoading } = useAccessibleCourses();
  const [courseId, setCourseId] = useState('');

  useEffect(() => {
    if (!courseId && courses.length > 0) setCourseId(courses[0]!.id);
  }, [courses, courseId]);

  return (
    <AppShell>
      <PageHeader title="Transcripts" description="Enter exam marks per course and exam term." />

      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : courses.length === 0 ? (
        <EmptyState icon={GraduationCap} title="No courses yet" description="Exam marks will appear here once you have a course." />
      ) : (
        <div className="flex flex-col gap-4">
          <CourseSwitcher courses={courses} selectedCourseId={courseId} onSelect={setCourseId} />
          {courseId ? <ExamMarksEntrySection courseId={courseId} isAdmin={false} /> : null}
        </div>
      )}
    </AppShell>
  );
};
