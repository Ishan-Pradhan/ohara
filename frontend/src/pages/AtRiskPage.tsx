import { useState, useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';

import { useAccessibleCourses } from '../features/courses/useAccessibleCourses.js';
import { AppShell } from '../components/layout/AppShell.js';
import { PageHeader } from '../components/layout/PageHeader.js';
import { CourseSwitcher } from '../components/CourseSwitcher.js';
import { Skeleton } from '../components/ui/Skeleton.js';
import { EmptyState } from '../components/ui/EmptyState.js';
import { AtRiskSection } from './admin/course-content/AtRiskSection.js';

export const AtRiskPage = () => {
  const { courses, isLoading } = useAccessibleCourses();
  const [courseId, setCourseId] = useState('');

  useEffect(() => {
    if (!courseId && courses.length > 0) setCourseId(courses[0]!.id);
  }, [courses, courseId]);

  return (
    <AppShell>
      <PageHeader title="At-Risk Students" description="Students flagged from grades, attendance, and missed work, by course." />

      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : courses.length === 0 ? (
        <EmptyState icon={AlertTriangle} title="No courses yet" description="At-risk flags will appear here once you have a course." />
      ) : (
        <div className="flex flex-col gap-4">
          <CourseSwitcher courses={courses} selectedCourseId={courseId} onSelect={setCourseId} />
          {courseId ? <AtRiskSection courseId={courseId} /> : null}
        </div>
      )}
    </AppShell>
  );
};
