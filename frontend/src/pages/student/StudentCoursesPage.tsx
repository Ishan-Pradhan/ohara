import { useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, ChevronDown, GraduationCap, ListPlus, MapPin, User } from 'lucide-react';

import { useCurrentUser } from '../../features/auth/useAuth.js';
import {
  useDropElective,
  useEnrollInElective,
  useStudentElectives,
  useStudentPastCourses,
  useStudentPlacement,
} from '../../features/placement/usePlacement.js';
import { useStudentDashboard } from '../../features/dashboard/useDashboard.js';
import type { ElectiveCourse, PastCourse, StudentPlacement } from '../../features/placement/placement.schema.js';
import type { PerformanceCourse } from '../../features/dashboard/dashboard.schema.js';
import { AppShell } from '../../components/layout/AppShell.js';
import { PageHeader } from '../../components/layout/PageHeader.js';
import { Badge } from '../../components/ui/Badge.js';
import { Button } from '../../components/ui/Button.js';
import { Card } from '../../components/ui/Card.js';
import { ProgressRing } from '../../components/ui/ProgressRing.js';
import { Skeleton } from '../../components/ui/Skeleton.js';
import { EmptyState } from '../../components/ui/EmptyState.js';
import { cn } from '../../lib/cn.js';

export const StudentCoursesPage = () => {
  const { data: currentUser } = useCurrentUser();
  const studentId = currentUser?.id ?? '';
  const { data: placement, isLoading, isError } = useStudentPlacement(studentId);
  const { data: dashboard } = useStudentDashboard(Boolean(studentId));

  const performanceByCourseId = new Map(
    (dashboard?.performance.courses ?? []).map((c) => [c.courseId, c]),
  );

  const placementLine = placement
    ? [placement.program?.name, placement.class?.name, placement.section ? `Section ${placement.section.name}` : null]
        .filter(Boolean)
        .join(' · ')
    : undefined;

  return (
    <AppShell>
      <PageHeader
        title="My Courses"
        description={placementLine ?? 'Courses you’re enrolled in'}
        actions={
          placement ? (
            <Link
              to="/transcripts"
              className="inline-flex items-center justify-center gap-2 rounded-control border border-border bg-surface px-4 py-2.5 text-sm font-medium text-fg transition-colors hover:bg-surface-hover hover:border-border-strong active:scale-[0.98]"
            >
              <GraduationCap className="size-4" aria-hidden />
              Transcript
            </Link>
          ) : undefined
        }
      />

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      ) : isError ? (
        <EmptyState
          icon={MapPin}
          title="Not placed yet"
          description="You haven't been placed into a class for this academic year — contact an admin."
        />
      ) : !placement || placement.courses.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="No courses yet"
          description="You aren't enrolled in any courses yet — check back once you've been added to one."
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {placement.courses.map((course) => (
            <StudentCourseCard
              key={course.id}
              course={course}
              performance={performanceByCourseId.get(course.id)}
            />
          ))}
        </div>
      )}

      {!isLoading && !isError && placement ? (
        <div className="mt-10">
          <div className="mb-3 flex items-center gap-2">
            <GraduationCap className="size-4 text-subtle" aria-hidden />
            <h2 className="text-sm font-semibold text-fg">Electives available this semester</h2>
          </div>
          <ElectivesSection studentId={studentId} />
        </div>
      ) : null}

      <PastCoursesSection studentId={studentId} />
    </AppShell>
  );
};

interface StudentCourseCardProps {
  course: StudentPlacement['courses'][number];
  performance?: PerformanceCourse;
}

const StudentCourseCard = ({ course, performance }: StudentCourseCardProps) => (
  <Link to={`/student/courses/${course.id}`} className="group">
    <Card className="flex h-full flex-col gap-4 transition-all group-hover:-translate-y-0.5 group-hover:border-primary/30 group-hover:shadow-md">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-3">
          {performance?.averageGrade !== undefined && performance.averageGrade !== null ? (
            <ProgressRing value={performance.averageGrade} size={40} strokeWidth={4} className="shrink-0" />
          ) : (
            <div className="flex size-10 items-center justify-center rounded-full bg-primary-soft">
              <BookOpen className="size-5 text-primary" aria-hidden />
            </div>
          )}
        </div>
        <Badge variant={course.isPublished ? 'success' : 'neutral'}>
          {course.isPublished ? 'Published' : 'Not published yet'}
        </Badge>
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold text-fg group-hover:text-primary">{course.title}</p>
        <p className="mt-0.5 text-xs text-subtle">{course.code}</p>
      </div>

      <p className="flex items-center gap-1.5 truncate text-xs text-muted">
        <User className="size-3.5 shrink-0" aria-hidden />
        {course.teachers.length > 0
          ? course.teachers.map((t) => t.name).join(', ')
          : 'No teacher assigned yet'}
      </p>

      {performance ? (
        <div className="flex items-center gap-4 border-t border-border pt-3 text-xs text-muted">
          <span>
            Attendance{' '}
            <span className="font-medium text-fg">
              {performance.attendancePercentage === null ? '—' : `${performance.attendancePercentage.toFixed(0)}%`}
            </span>
          </span>
          {performance.missingSubmissions > 0 ? (
            <span className="text-danger">{performance.missingSubmissions} missing</span>
          ) : null}
        </div>
      ) : null}
    </Card>
  </Link>
);

interface ElectivesSectionProps {
  studentId: string;
}

const ElectivesSection = ({ studentId }: ElectivesSectionProps) => {
  const { data: electives, isLoading, isError } = useStudentElectives(studentId);
  const enroll = useEnrollInElective(studentId);
  const drop = useDropElective(studentId);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-2">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  if (isError) {
    return <EmptyState icon={ListPlus} title="Could not load electives" />;
  }

  if (!electives || electives.length === 0) {
    return (
      <EmptyState
        icon={ListPlus}
        title="No electives available this semester"
      />
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {electives.map((course) => (
        <ElectiveCard
          key={course.id}
          course={course}
          onEnroll={() => enroll.mutate(course.id)}
          onDrop={() => drop.mutate(course.id)}
          enrollPending={enroll.isPending}
          dropPending={drop.isPending}
        />
      ))}
    </div>
  );
};

interface ElectiveCardProps {
  course: ElectiveCourse;
  onEnroll: () => void;
  onDrop: () => void;
  enrollPending: boolean;
  dropPending: boolean;
}

const ElectiveCard = ({ course, onEnroll, onDrop, enrollPending, dropPending }: ElectiveCardProps) => {
  const isFull = course.capacity !== null && course.enrolledCount >= course.capacity;

  return (
    <Card padding="sm" className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-fg">{course.title}</p>
        <p className="truncate text-xs text-muted">{course.code}</p>
        {course.description ? (
          <p className="mt-1 truncate text-xs text-muted">{course.description}</p>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {course.capacity !== null ? (
          <Badge variant={isFull ? 'warning' : 'neutral'}>
            {course.enrolledCount}/{course.capacity}
          </Badge>
        ) : (
          <Badge>{course.enrolledCount} student{course.enrolledCount === 1 ? '' : 's'}</Badge>
        )}
        {course.isEnrolled ? (
          <Button size="sm" variant="secondary" loading={dropPending} onClick={onDrop}>
            Drop
          </Button>
        ) : (
          <Button size="sm" loading={enrollPending} disabled={isFull} onClick={onEnroll}>
            Enroll
          </Button>
        )}
      </div>
    </Card>
  );
};

/** Completed-course history — collapsed by default since it only grows
 * every semester. Each card opens the same course screens (Assignments/
 * Quizzes/Grades/Attendance) in read-only mode instead of the live "content"
 * landing tab, since that (and Tutor/Study Tools) don't apply once a
 * semester's done. */
const PastCoursesSection = ({ studentId }: { studentId: string }) => {
  const [expanded, setExpanded] = useState(false);
  const { data: pastCourses, isLoading } = useStudentPastCourses(studentId);

  if (isLoading || !pastCourses || pastCourses.length === 0) return null;

  return (
    <div className="mt-10">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="mb-3 flex items-center gap-2 text-sm font-semibold text-fg"
      >
        <ChevronDown className={cn('size-4 text-subtle transition-transform', expanded ? '' : '-rotate-90')} aria-hidden />
        Past courses
        <span className="font-normal text-subtle">({pastCourses.length})</span>
      </button>

      {expanded ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {pastCourses.map((course) => (
            <PastCourseCard key={`${course.id}-${course.batchId}`} course={course} />
          ))}
        </div>
      ) : null}
    </div>
  );
};

const PastCourseCard = ({ course }: { course: PastCourse }) => (
  <Link to={`/student/courses/${course.id}/grades`} className="group">
    <Card className="flex h-full flex-col gap-4 opacity-80 transition-all group-hover:opacity-100 group-hover:-translate-y-0.5 group-hover:border-primary/30 group-hover:shadow-md">
      <div className="flex items-start justify-between gap-2">
        <div className="flex size-10 items-center justify-center rounded-full bg-surface-hover">
          <BookOpen className="size-5 text-subtle" aria-hidden />
        </div>
        <Badge variant="neutral">{course.batchName ?? 'Completed'}</Badge>
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold text-fg group-hover:text-primary">{course.title}</p>
        <p className="mt-0.5 text-xs text-subtle">{course.code}</p>
      </div>

      <p className="flex items-center gap-1.5 truncate text-xs text-muted">
        <User className="size-3.5 shrink-0" aria-hidden />
        {course.teachers.length > 0
          ? course.teachers.map((t) => t.name).join(', ')
          : 'No teacher assigned'}
      </p>
    </Card>
  </Link>
);
