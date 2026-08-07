import { useState, useEffect } from 'react';
import { BarChart3 } from 'lucide-react';

import { useCurrentUser } from '../features/auth/useAuth.js';
import { useAccessibleCourses } from '../features/courses/useAccessibleCourses.js';
import { AppShell } from '../components/layout/AppShell.js';
import { PageHeader } from '../components/layout/PageHeader.js';
import { CourseSwitcher } from '../components/CourseSwitcher.js';
import { Skeleton } from '../components/ui/Skeleton.js';
import { EmptyState } from '../components/ui/EmptyState.js';
import { GradebookSection } from './admin/course-content/GradebookSection.js';
import { StudentGradesSection } from './student/StudentGradesSection.js';

export const GradebookPage = () => {
  const { data: user } = useCurrentUser();
  const { courses, isLoading } = useAccessibleCourses();
  const [courseId, setCourseId] = useState('');

  useEffect(() => {
    if (!courseId && courses.length > 0) setCourseId(courses[0]!.id);
  }, [courses, courseId]);

  return (
    <AppShell>
      <PageHeader title="Gradebook" description="Every assignment and quiz score, by course." />

      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : courses.length === 0 ? (
        <EmptyState icon={BarChart3} title="No courses yet" description="Grades will appear here once you have a course." />
      ) : (
        <div className="flex flex-col gap-4">
          <CourseSwitcher courses={courses} selectedCourseId={courseId} onSelect={setCourseId} />
          {courseId ? (
            user?.role === 'student' ? (
              <StudentGradesSection courseId={courseId} />
            ) : (
              <GradebookSection courseId={courseId} />
            )
          ) : null}
        </div>
      )}
    </AppShell>
  );
};
