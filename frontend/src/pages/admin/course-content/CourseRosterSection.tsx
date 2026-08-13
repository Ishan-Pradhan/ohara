import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { GraduationCap } from 'lucide-react';

import { useCourseRoster } from '../../../features/teacher/useTeacher.js';
import type { RosterStudent } from '../../../features/teacher/teacher.schema.js';
import { Card } from '../../../components/ui/Card.js';
import { Badge } from '../../../components/ui/Badge.js';
import { Avatar } from '../../../components/ui/Avatar.js';
import { Skeleton } from '../../../components/ui/Skeleton.js';
import { EmptyState } from '../../../components/ui/EmptyState.js';

interface CourseRosterSectionProps {
  courseId: string;
  /** Student profile pages differ by role — `/admin/students` vs
   * `/teacher/students` — so the caller decides which one a click leads to. */
  profileBasePath: '/admin/students' | '/teacher/students';
  /** Optional per-row actions (e.g. the teacher roster's "Flag" button) —
   * kept out of this shared component since only the teacher view has it. */
  renderActions?: (student: RosterStudent) => ReactNode;
}

export const CourseRosterSection = ({ courseId, profileBasePath, renderActions }: CourseRosterSectionProps) => {
  const { data: students, isLoading } = useCourseRoster(courseId);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-2">
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-14 w-full" />
      </div>
    );
  }

  if (!students || students.length === 0) {
    return <EmptyState icon={GraduationCap} title="No students enrolled yet" />;
  }

  return (
    <div className="flex flex-col gap-2">
      {students.map((student) => (
        <Card key={student.id} padding="sm" className="flex items-center justify-between gap-3">
          <Link
            to={`${profileBasePath}/${student.id}`}
            className="flex min-w-0 flex-1 items-center gap-3 rounded-control transition-colors hover:text-primary"
          >
            <Avatar name={student.name} src={student.avatarUrl} size="sm" />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-fg">{student.name}</p>
              <p className="truncate text-xs text-muted">{student.email}</p>
            </div>
          </Link>
          <div className="flex shrink-0 items-center gap-2">
            <Badge variant={student.status === 'active' ? 'success' : 'neutral'}>{student.status}</Badge>
            {renderActions?.(student)}
          </div>
        </Card>
      ))}
    </div>
  );
};
