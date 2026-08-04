import { Link } from 'react-router-dom';
import { BookOpen, Users } from 'lucide-react';

import { useMyCourses } from '../../features/teacher/useTeacher.js';
import { AppShell } from '../../components/layout/AppShell.js';
import { PageHeader } from '../../components/layout/PageHeader.js';
import { Card } from '../../components/ui/Card.js';
import { Badge } from '../../components/ui/Badge.js';
import { Skeleton } from '../../components/ui/Skeleton.js';
import { EmptyState } from '../../components/ui/EmptyState.js';

export const MyCoursesPage = () => {
  const { data: courses, isLoading } = useMyCourses();

  return (
    <AppShell>
      <PageHeader
        title="My Courses"
        description="Courses you're assigned to teach — upload material, build structure, and manage the roster."
      />

      {isLoading ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : !courses || courses.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="No courses assigned yet"
          description="An admin assigns teachers to courses — check back once you've been added to one."
        />
      ) : (
        <div className="flex flex-col gap-2">
          {courses.map((course) => (
            <Card key={course.id} padding="sm" className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-fg">{course.title}</p>
                <p className="truncate text-xs text-muted">{course.code}</p>
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
                  to={`/admin/courses/${course.id}`}
                  className="inline-flex items-center justify-center gap-2 rounded-control bg-primary px-3 py-1.5 text-sm font-medium text-primary-fg hover:bg-primary-hover"
                >
                  Content
                </Link>
              </div>
            </Card>
          ))}
        </div>
      )}
    </AppShell>
  );
};
