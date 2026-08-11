import { Link } from 'react-router-dom';
import { AlertTriangle, BookOpen, Users } from 'lucide-react';

import { useMyCourses } from '../../features/teacher/useTeacher.js';
import { useTeacherDashboard } from '../../features/teacherIntelligence/useTeacherDashboard.js';
import type { TeacherCourse } from '../../features/teacher/teacher.schema.js';
import { AppShell } from '../../components/layout/AppShell.js';
import { PageHeader } from '../../components/layout/PageHeader.js';
import { Card } from '../../components/ui/Card.js';
import { Badge } from '../../components/ui/Badge.js';
import { ProgressRing } from '../../components/ui/ProgressRing.js';
import { Skeleton } from '../../components/ui/Skeleton.js';
import { EmptyState } from '../../components/ui/EmptyState.js';

const fmtPct = (v: number | null | undefined) => (v === null || v === undefined ? '—' : `${v.toFixed(0)}%`);

const CourseCard = ({
  course,
  stats,
}: {
  course: TeacherCourse;
  stats?: {
    enrollmentCount: number;
    classAverage: number | null;
    attendanceRate: number | null;
    atRiskCount: number;
  };
}) => (
  <Card className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
    <div className="flex min-w-0 items-center gap-3">
      {stats && stats.classAverage !== null ? (
        <ProgressRing value={stats.classAverage} size={44} strokeWidth={4} className="shrink-0" />
      ) : null}
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-fg">{course.title}</p>
        <p className="truncate text-xs text-muted">
          {course.code}
          {course.programName ? ` · ${course.programName}` : ''}
          {course.className ? ` · ${course.className}` : ''}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
          <span>
            <span className="font-medium text-fg">{stats ? stats.enrollmentCount : '—'}</span> students
          </span>
          <span>
            Attendance <span className="font-medium text-fg">{fmtPct(stats?.attendanceRate)}</span>
          </span>
          {stats && stats.atRiskCount > 0 ? (
            <Badge variant="danger" className="gap-1 text-xs">
              <AlertTriangle className="size-2.5" aria-hidden />
              {stats.atRiskCount} at-risk
            </Badge>
          ) : null}
        </div>
      </div>
    </div>
    <div className="flex shrink-0 items-center gap-2">
      <Badge variant={course.isPublished ? 'success' : 'neutral'}>
        {course.isPublished ? 'Published' : 'Draft'}
      </Badge>
      <Link
        to={`/teacher/courses/${course.id}/students`}
        className="inline-flex items-center justify-center gap-2 rounded-control px-3 py-1.5 text-sm font-medium text-fg transition-colors hover:bg-surface-hover"
      >
        <Users className="size-4" aria-hidden />
        Roster
      </Link>
      <Link
        to={`/teacher/courses/${course.id}`}
        className="inline-flex items-center justify-center gap-2 rounded-control bg-primary px-3 py-1.5 text-sm font-medium text-primary-fg hover:bg-primary-hover"
      >
        Manage
      </Link>
    </div>
  </Card>
);

export const MyCoursesPage = () => {
  const { data: courses, isLoading } = useMyCourses();
  const { data: dashboard } = useTeacherDashboard();

  const statsByCourseId = new Map((dashboard?.courses ?? []).map((c) => [c.courseId, c]));

  return (
    <AppShell>
      <PageHeader
        title="My Courses"
        description="Courses you're assigned to teach — upload material, build structure, and manage the roster."
      />

      {isLoading ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      ) : !courses || courses.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="No courses assigned yet"
          description="An admin assigns teachers to courses — check back once you've been added to one."
        />
      ) : (
        <div className="flex flex-col gap-3">
          {courses.map((course) => (
            <CourseCard key={course.id} course={course} stats={statsByCourseId.get(course.id)} />
          ))}
        </div>
      )}
    </AppShell>
  );
};
