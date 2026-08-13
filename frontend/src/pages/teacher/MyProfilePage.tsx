import { BookOpen } from 'lucide-react';

import { useCurrentUser } from '../../features/auth/useAuth.js';
import { useMyCourses } from '../../features/teacher/useTeacher.js';
import { AppShell } from '../../components/layout/AppShell.js';
import { PageHeader } from '../../components/layout/PageHeader.js';
import { Card } from '../../components/ui/Card.js';
import { Skeleton } from '../../components/ui/Skeleton.js';
import { EmptyState } from '../../components/ui/EmptyState.js';
import { StaffInfoCard } from '../admin/StaffInfoCard.js';

export const MyProfilePage = () => {
  const { data: user, isLoading } = useCurrentUser();
  const { data: courses, isLoading: coursesLoading } = useMyCourses(Boolean(user));

  if (isLoading || !user) {
    return (
      <AppShell>
        <Skeleton className="h-10 w-64" />
        <div className="mt-4 flex flex-col gap-2">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      </AppShell>
    );
  }

  // Route-guarded to teachers only (teacherRoute) — this narrows the type
  // for StaffInfoCard below rather than being a reachable branch.
  if (user.role !== 'teacher') {
    return null;
  }

  return (
    <AppShell>
      <PageHeader title="My Profile" description="Your account and the courses you teach." />

      <div className="mb-6">
        {/* Already checked role above — CurrentUser is a flat type (role
            isn't a discriminant TS can narrow the whole object on), so
            re-assert what's already been verified. */}
        <StaffInfoCard user={{ ...user, role: user.role as 'teacher' }} />
      </div>

      <div>
        <h2 className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-subtle">
          <BookOpen className="size-3.5" aria-hidden />
          Courses
        </h2>
        {coursesLoading ? (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : !courses || courses.length === 0 ? (
          <EmptyState icon={BookOpen} title="Not assigned to any courses yet" />
        ) : (
          <div className="flex flex-col gap-2">
            {courses.map((course) => (
              <Card key={course.id} padding="sm" className="flex flex-wrap items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-fg">{course.title}</p>
                  <p className="truncate text-xs text-muted">{course.code}</p>
                </div>
                <div className="flex flex-wrap items-center gap-1.5 text-xs text-subtle">
                  {course.programName ? <span>{course.programName}</span> : null}
                  {course.className ? (
                    <span>
                      · {course.className}
                      {course.sectionName ? ` — ${course.sectionName}` : ''}
                    </span>
                  ) : null}
                  {course.batchName ? <span>· Batch {course.batchName}</span> : null}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
};
