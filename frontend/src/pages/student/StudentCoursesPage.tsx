import { Link } from 'react-router-dom';
import { BookOpen, GraduationCap, ListPlus, MapPin, User } from 'lucide-react';

import { useCurrentUser } from '../../features/auth/useAuth.js';
import {
  useDropElective,
  useEnrollInElective,
  useStudentElectives,
  useStudentPlacement,
} from '../../features/placement/usePlacement.js';
import type { ElectiveCourse } from '../../features/placement/placement.schema.js';
import { AppShell } from '../../components/layout/AppShell.js';
import { PageHeader } from '../../components/layout/PageHeader.js';
import { Badge } from '../../components/ui/Badge.js';
import { Button } from '../../components/ui/Button.js';
import { Card } from '../../components/ui/Card.js';
import { Skeleton } from '../../components/ui/Skeleton.js';
import { EmptyState } from '../../components/ui/EmptyState.js';

export const StudentCoursesPage = () => {
  const { data: currentUser } = useCurrentUser();
  const studentId = currentUser?.id ?? '';
  const { data: placement, isLoading, isError } = useStudentPlacement(studentId);

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
            <Link key={course.id} to={`/student/courses/${course.id}`} className="group">
              <Card className="flex h-full flex-col gap-4 transition-all group-hover:-translate-y-0.5 group-hover:border-primary/30 group-hover:shadow-md">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex size-10 items-center justify-center rounded-full bg-primary-soft">
                    <BookOpen className="size-5 text-primary" aria-hidden />
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
              </Card>
            </Link>
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
    </AppShell>
  );
};

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
