import { useEffect, useMemo, useState } from 'react';
import { Flag, GraduationCap, Users } from 'lucide-react';

import { useMyCourses } from '../../features/teacher/useTeacher.js';
import { useAttendanceSections, useAttendanceRoster } from '../../features/attendance/useAttendance.js';
import { AppShell } from '../../components/layout/AppShell.js';
import { PageHeader } from '../../components/layout/PageHeader.js';
import { Card } from '../../components/ui/Card.js';
import { Button } from '../../components/ui/Button.js';
import { Avatar } from '../../components/ui/Avatar.js';
import { Skeleton } from '../../components/ui/Skeleton.js';
import { EmptyState } from '../../components/ui/EmptyState.js';
import { CourseSwitcher } from '../../components/CourseSwitcher.js';
import { cn } from '../../lib/cn.js';
import { FlagStudentDialog } from './FlagStudentDialog.js';

const PillTabs = ({
  options,
  value,
  onSelect,
}: {
  options: { id: string; label: string }[];
  value: string;
  onSelect: (id: string) => void;
}) => (
  <div
    role="tablist"
    className="inline-flex max-w-full gap-1 overflow-x-auto rounded-control bg-surface-hover p-1 scrollbar-none"
  >
    {options.map((option) => {
      const active = option.id === value;
      return (
        <button
          key={option.id}
          type="button"
          role="tab"
          aria-selected={active}
          onClick={() => onSelect(option.id)}
          className={cn(
            'shrink-0 whitespace-nowrap rounded-[0.4rem] px-3.5 py-1.5 text-sm font-medium transition-colors',
            'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
            active ? 'bg-surface text-fg shadow-sm' : 'text-muted hover:text-fg',
          )}
        >
          {option.label}
        </button>
      );
    })}
  </div>
);

export const MySectionPage = () => {
  const { data: courses, isLoading: coursesLoading } = useMyCourses();

  const semesters = useMemo(() => {
    const seen = new Set<string>();
    const list: string[] = [];
    for (const course of courses ?? []) {
      const label = course.className ?? 'Unassigned';
      if (!seen.has(label)) {
        seen.add(label);
        list.push(label);
      }
    }
    return list;
  }, [courses]);

  const [semester, setSemester] = useState('');
  useEffect(() => {
    if (!semester && semesters.length > 0) setSemester(semesters[0]!);
  }, [semesters, semester]);

  const coursesInSemester = useMemo(
    () => (courses ?? []).filter((course) => (course.className ?? 'Unassigned') === semester),
    [courses, semester],
  );

  const [courseId, setCourseId] = useState('');
  useEffect(() => {
    if (coursesInSemester.length === 0) {
      setCourseId('');
    } else if (!coursesInSemester.some((course) => course.id === courseId)) {
      setCourseId(coursesInSemester[0]!.id);
    }
  }, [coursesInSemester, courseId]);

  const { data: sections, isLoading: sectionsLoading } = useAttendanceSections(courseId);

  const [sectionId, setSectionId] = useState('');
  useEffect(() => {
    if (!sections || sections.length === 0) {
      setSectionId('');
    } else if (!sections.some((s) => s.id === sectionId)) {
      setSectionId(sections[0]!.id);
    }
  }, [sections, sectionId]);

  const { data: roster, isLoading: rosterLoading } = useAttendanceRoster(courseId, sectionId);
  const [flagging, setFlagging] = useState<{ id: string; name: string } | null>(null);

  const isLoading = coursesLoading || (Boolean(courseId) && sectionsLoading);

  return (
    <AppShell>
      <PageHeader
        title="My Students"
        description="Browse the students you teach by semester, course, and section."
      />

      {isLoading ? (
        <div className="flex flex-col gap-4">
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </div>
      ) : !courses || courses.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No courses assigned yet"
          description="An admin assigns teachers to courses — check back once you've been added to one."
        />
      ) : (
        <div className="flex flex-col gap-4">
          {semesters.length > 1 ? (
            <PillTabs
              options={semesters.map((s) => ({ id: s, label: s }))}
              value={semester}
              onSelect={setSemester}
            />
          ) : null}

          <CourseSwitcher
            courses={coursesInSemester.map((c) => ({ id: c.id, title: c.title, code: c.code }))}
            selectedCourseId={courseId}
            onSelect={setCourseId}
          />

          {sections && sections.length > 1 ? (
            <PillTabs
              options={sections.map((s) => ({ id: s.id, label: `Section ${s.name}` }))}
              value={sectionId}
              onSelect={setSectionId}
            />
          ) : null}

          {sections && sections.length === 0 ? (
            <EmptyState
              icon={GraduationCap}
              title="No sections set up for this course yet"
              description="An admin needs to create a section under this course's class before students can be placed."
            />
          ) : rosterLoading ? (
            <div className="flex flex-col gap-2">
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
            </div>
          ) : !roster || roster.length === 0 ? (
            <EmptyState icon={Users} title="No students placed in this section yet" />
          ) : (
            <div className="flex flex-col gap-2">
              {roster.map((student) => (
                <Card key={student.studentId} padding="sm" className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar name={student.studentName} size="sm" />
                    <p className="truncate text-sm font-medium text-fg">{student.studentName}</p>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setFlagging({ id: student.studentId, name: student.studentName })}
                  >
                    <Flag className="size-4" aria-hidden />
                    Flag
                  </Button>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {flagging ? (
        <FlagStudentDialog
          studentId={flagging.id}
          studentName={flagging.name}
          courseId={courseId}
          sectionId={sectionId || undefined}
          open={Boolean(flagging)}
          onOpenChange={(open) => !open && setFlagging(null)}
        />
      ) : null}
    </AppShell>
  );
};
