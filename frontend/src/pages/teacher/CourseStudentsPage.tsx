import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ChevronLeft, Flag } from 'lucide-react';

import { useCourseRoster } from '../../features/teacher/useTeacher.js';
import type { RosterStudent } from '../../features/teacher/teacher.schema.js';
import { AppShell } from '../../components/layout/AppShell.js';
import { PageHeader } from '../../components/layout/PageHeader.js';
import { Button } from '../../components/ui/Button.js';
import { CourseRosterSection } from '../admin/course-content/CourseRosterSection.js';
import { FlagStudentDialog } from './FlagStudentDialog.js';

export const CourseStudentsPage = () => {
  const { courseId = '' } = useParams();
  const { data: students } = useCourseRoster(courseId);
  const [flagging, setFlagging] = useState<RosterStudent | null>(null);

  return (
    <AppShell>
      <Link to="/teacher/courses" className="mb-1 flex items-center gap-1 text-sm text-muted hover:text-fg">
        <ChevronLeft className="size-3.5" aria-hidden />
        My Courses
      </Link>
      <PageHeader
        title="Course roster"
        description={
          students && students.length > 0
            ? `${students.length} student${students.length === 1 ? '' : 's'} currently enrolled.`
            : 'Students currently enrolled in this course.'
        }
      />

      <CourseRosterSection
        courseId={courseId}
        profileBasePath="/teacher/students"
        renderActions={(student) => (
          <Button size="sm" variant="ghost" onClick={() => setFlagging(student)}>
            <Flag className="size-4" aria-hidden />
            Flag
          </Button>
        )}
      />

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
