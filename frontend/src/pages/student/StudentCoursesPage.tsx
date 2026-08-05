import { Link } from 'react-router-dom';
import { BookOpen, ListPlus, MapPin } from 'lucide-react';

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

      {!isLoading && !isError && placement ? (
        <div className="mt-8">
          <h2 className="mb-3 text-sm font-semibold text-fg">Electives available this semester</h2>
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
