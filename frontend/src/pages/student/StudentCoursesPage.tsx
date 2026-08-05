import { Link } from 'react-router-dom';
import { BookOpen, MapPin } from 'lucide-react';

import { useCurrentUser } from '../../features/auth/useAuth.js';
import { useStudentPlacement } from '../../features/placement/usePlacement.js';
import { AppShell } from '../../components/layout/AppShell.js';
import { PageHeader } from '../../components/layout/PageHeader.js';
import { Card } from '../../components/ui/Card.js';
import { Skeleton } from '../../components/ui/Skeleton.js';
import { EmptyState } from '../../components/ui/EmptyState.js';

export const StudentCoursesPage = () => {
  const { data: currentUser } = useCurrentUser();
  const studentId = currentUser?.id ?? '';
  const { data: placement, isLoading, isError } = useStudentPlacement(studentId);

  return (
    <AppShell>
      <PageHeader title="My Courses" description="Courses you're enrolled in" />

      {isLoading ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
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
        <div className="flex flex-col gap-2">
          {placement.courses.map((course) => (
            <Link key={course.id} to={`/student/courses/${course.id}`}>
              <Card padding="sm" className="flex items-center justify-between gap-3 transition-colors hover:bg-surface-hover">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-fg">{course.title}</p>
                  <p className="truncate text-xs text-muted">{course.code}</p>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </AppShell>
  );
};
