import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { GraduationCap } from 'lucide-react';

import { useCurrentUser } from '../features/auth/useAuth.js';
import {
  usePrograms,
  useClasses,
  useBatches,
  useBatchCurrentPlacement,
  useSections,
  useAcademicYears,
} from '../features/institution/useInstitution.js';
import { useExamTerms } from '../features/examMarks/useExamMarks.js';
import { useMyCourses } from '../features/teacher/useTeacher.js';
import { AppShell } from '../components/layout/AppShell.js';
import { PageHeader } from '../components/layout/PageHeader.js';
import { TeacherCourseNav } from '../components/TeacherCourseNav.js';
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

/** Admin view: Program → Batch → Semester (Class) → Section → Exam Term → spreadsheet grid */
const AdminBulkMarksWorkspace = () => {
  const { data: programs, isLoading: programsLoading } = usePrograms();
  const { data: academicYears } = useAcademicYears();

  const [programId, setProgramId] = useState('');
  const [batchId, setBatchId] = useState('');
  const [classId, setClassId] = useState('');
  const [sectionId, setSectionId] = useState('');
  const [examTermId, setExamTermId] = useState('');

  const { data: batches } = useBatches(programId || undefined);
  // The full semester history for this batch, not just its current one —
  // browsing past semesters (correcting an old exam-marks entry) is a real
  // need. useBatchCurrentPlacement (below) is the separate signal for which
  // of these is current, used only for labeling (sorted first), never filtering.
  const { data: semesterOptions } = useClasses(batchId ? { programId: programId || undefined, batchId } : undefined);
  const { data: examTerms } = useExamTerms();
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

  const batchOptions = (batches ?? []).map((b) => ({ value: b.id, label: b.name }));
  const examTermOptions = (examTerms ?? []).map((t) => ({ value: t.id, label: t.name }));
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
  useEffect(() => { setBatchId(''); setClassId(''); setSectionId(''); }, [programId]);
  useEffect(() => { setClassId(''); setSectionId(''); }, [batchId]);
  useEffect(() => { setSectionId(''); }, [classId]);

  const ready = Boolean(classId && batchId && examTermId);

  return (
    <AppShell>
      <PageHeader
        title="Transcripts"
        description="Select program, batch, semester, section, and exam term to enter marks for the whole cohort."
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
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
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
              <label className="text-xs font-medium text-muted uppercase tracking-wide">Semester</label>
              <Select
                id="class-select"
                value={classId}
                onValueChange={setClassId}
                options={classOptions}
                placeholder={batchId ? 'Select semester…' : 'Choose a batch first'}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted uppercase tracking-wide">Section</label>
              <Select
                id="section-select"
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
            <BulkExamMarksEntry classId={classId} batchId={batchId} examTermId={examTermId} sectionId={sectionId || undefined} />
          ) : (
            <EmptyState
              icon={GraduationCap}
              title="Choose selections above"
              description="Select a program, batch, semester, section, and exam term to view and edit marks for the entire cohort."
            />
          )}
        </div>
      )}
    </AppShell>
  );
};

/** Teacher view: course switcher with program/batch/section context */
const TeacherMarksWorkspace = () => {
  const { data: courses, isLoading } = useMyCourses();
  const [courseId, setCourseId] = useState('');

  const selectedCourse = courses?.find((c) => c.id === courseId);

  return (
    <AppShell>
      <PageHeader title="Transcripts" description="Enter exam marks per course and exam term." />

      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : !courses || courses.length === 0 ? (
        <EmptyState icon={GraduationCap} title="No courses yet" description="Exam marks will appear here once you have a course." />
      ) : (
        <div className="flex flex-col gap-4">
          <TeacherCourseNav courses={courses} onSelect={setCourseId} />
          {courseId ? (
            <ExamMarksEntrySection
              courseId={courseId}
              isAdmin={false}
              programName={selectedCourse?.programName}
              className={selectedCourse?.className}
              batchName={selectedCourse?.batchName}
              sectionName={selectedCourse?.sectionName}
            />
          ) : null}
        </div>
      )}
    </AppShell>
  );
};
