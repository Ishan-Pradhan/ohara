import { useEffect, useState } from 'react';

import type { TeacherCourse } from '../features/teacher/teacher.schema.js';
import { CourseSwitcher } from './CourseSwitcher.js';
import { Select } from './ui/Select.js';

interface TeacherCourseNavProps {
  courses: TeacherCourse[];
  onSelect: (courseId: string) => void;
}

const uniqueOptions = (
  courses: TeacherCourse[],
  idKey: 'programId' | 'classId',
  nameKey: 'programName' | 'className',
): { value: string; label: string }[] => {
  const byId = new Map<string, string>();
  for (const course of courses) {
    const id = course[idKey];
    const name = course[nameKey];
    if (id && name && !byId.has(id)) byId.set(id, name);
  }
  return [...byId.entries()]
    .map(([value, label]) => ({ value, label }))
    .sort((a, b) => a.label.localeCompare(b.label));
};

/** Program + Semester filter above a course switcher, for teacher-facing
 * pages (Attendance/Gradebook/Transcript/At-Risk). A teacher can teach the
 * same subject in more than one program, so the plain switcher alone can
 * show two identically-titled pills with no way to tell them apart —
 * this adds a program/semester caption to each pill and, once there's
 * actually more than one to choose from, a filter to narrow the list.
 * Dropdown options are derived only from the teacher's own courses, never
 * the whole institution. */
export const TeacherCourseNav = ({ courses, onSelect }: TeacherCourseNavProps) => {
  const [programId, setProgramId] = useState('');
  const [classId, setClassId] = useState('');
  const [courseId, setCourseId] = useState('');

  const programOptions = uniqueOptions(courses, 'programId', 'programName');
  const classOptions = uniqueOptions(
    programId ? courses.filter((c) => c.programId === programId) : courses,
    'classId',
    'className',
  );

  const filteredCourses = courses.filter(
    (c) => (!programId || c.programId === programId) && (!classId || c.classId === classId),
  );

  // A program change can orphan the selected semester (it belonged to the
  // previous program's course set). classOptions is deliberately excluded —
  // it's a new array every render, and this should only re-run when the
  // program actually changes.
  useEffect(() => {
    setClassId((current) => (classOptions.some((o) => o.value === current) ? current : ''));
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [programId]);

  // Keep the selected course inside whatever the current filter allows,
  // same auto-select-first convention used elsewhere in this codebase.
  useEffect(() => {
    if (filteredCourses.length === 0) {
      if (courseId) setCourseId('');
      return;
    }
    if (!filteredCourses.some((c) => c.id === courseId)) {
      setCourseId(filteredCourses[0]!.id);
    }
  }, [filteredCourses, courseId]);

  // Deliberately excludes `onSelect` — several callers (Gradebook/AtRisk/
  // Attendance) pass an inline handler that also resets their own batchId
  // state, so it's a new function identity every render. Depending on it
  // here would re-fire this effect on every unrelated re-render (e.g. right
  // after the caller's own setBatchId call), immediately resetting the
  // batch selection the user just made back to "current". This should only
  // ever re-notify the parent when the selected course itself changes.
  useEffect(() => {
    onSelect(courseId);
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId]);

  return (
    <div className="flex flex-col gap-3">
      {(programOptions.length > 1 || classOptions.length > 1) && (
        <div className="flex flex-wrap gap-3">
          {programOptions.length > 1 && (
            <div className="flex w-48 flex-col gap-1.5">
              <label className="text-xs font-medium text-muted uppercase tracking-wide">Program</label>
              <Select value={programId} onValueChange={setProgramId} options={programOptions} placeholder="All programs" />
            </div>
          )}
          {classOptions.length > 1 && (
            <div className="flex w-48 flex-col gap-1.5">
              <label className="text-xs font-medium text-muted uppercase tracking-wide">Semester</label>
              <Select value={classId} onValueChange={setClassId} options={classOptions} placeholder="All semesters" />
            </div>
          )}
        </div>
      )}
      <CourseSwitcher
        courses={filteredCourses}
        selectedCourseId={courseId}
        onSelect={setCourseId}
        getSubtitle={(course) => [course.programName, course.className].filter(Boolean).join(' · ') || null}
      />
    </div>
  );
};
