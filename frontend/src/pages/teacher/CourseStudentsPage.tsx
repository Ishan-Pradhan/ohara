import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ChevronLeft, Flag, GraduationCap } from 'lucide-react';

import { useCourseRoster } from '../../features/teacher/useTeacher.js';
import type { RosterStudent } from '../../features/teacher/teacher.schema.js';
import { AppShell } from '../../components/layout/AppShell.js';
import { PageHeader } from '../../components/layout/PageHeader.js';
import { Card } from '../../components/ui/Card.js';
import { Badge } from '../../components/ui/Badge.js';
import { Button } from '../../components/ui/Button.js';
import { Avatar } from '../../components/ui/Avatar.js';
import { Skeleton } from '../../components/ui/Skeleton.js';
import { EmptyState } from '../../components/ui/EmptyState.js';
import { FlagStudentDialog } from './FlagStudentDialog.js';

export const CourseStudentsPage = () => {
  const { courseId = '' } = useParams();
  const { data: students, isLoading } = useCourseRoster(courseId);
  const [flagging, setFlagging] = useState<RosterStudent | null>(null);

  return (
    <AppShell>
      <Link to="/teacher/courses" className="mb-1 flex items-center gap-1 text-sm text-muted hover:text-fg">
        <ChevronLeft className="size-3.5" aria-hidden />
        My Courses
      </Link>
      <PageHeader title="Course roster" description="Students currently enrolled in this course." />

      {isLoading ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </div>
      ) : !students || students.length === 0 ? (
        <EmptyState icon={GraduationCap} title="No students enrolled yet" />
      ) : (
        <div className="flex flex-col gap-2">
          {students.map((student) => (
            <Card key={student.id} padding="sm" className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <Avatar name={student.name} src={student.avatarUrl} size="sm" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-fg">{student.name}</p>
                  <p className="truncate text-xs text-muted">{student.email}</p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Badge variant={student.status === 'active' ? 'success' : 'neutral'}>{student.status}</Badge>
                <Button size="sm" variant="ghost" onClick={() => setFlagging(student)}>
                  <Flag className="size-4" aria-hidden />
                  Flag
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {flagging ? (
        <FlagStudentDialog
          studentId={flagging.id}
          studentName={flagging.name}
          courseId={courseId}
          open={Boolean(flagging)}
          onOpenChange={(open) => !open && setFlagging(null)}
        />
      ) : null}
    </AppShell>
  );
};
