import { useParams } from 'react-router-dom';
import { Layers } from 'lucide-react';

import { useCurrentUser } from '../../features/auth/useAuth.js';
import { useStudentPlacement } from '../../features/placement/usePlacement.js';
import { useOutline } from '../../features/tutor/useTutor.js';
import { AppShell } from '../../components/layout/AppShell.js';
import { PageHeader } from '../../components/layout/PageHeader.js';
import { Card } from '../../components/ui/Card.js';
import { Badge } from '../../components/ui/Badge.js';
import { Skeleton } from '../../components/ui/Skeleton.js';
import { EmptyState } from '../../components/ui/EmptyState.js';
import { TutorPanel } from './TutorPanel.js';

export const StudentCoursePage = () => {
  const { courseId = '' } = useParams();
  const { data: currentUser } = useCurrentUser();
  const studentId = currentUser?.id ?? '';
  const { data: placement } = useStudentPlacement(studentId);
  const { data: modules, isLoading } = useOutline(courseId);

  const course = placement?.courses.find((c) => c.id === courseId);

  return (
    <AppShell>
      <PageHeader
        title={course?.title ?? 'Course'}
        description={course?.code}
      />

      <div className="grid grid-cols-1 gap-6 lg:h-[calc(100dvh-14rem)] lg:grid-cols-[280px_1fr]">
        <div className="flex flex-col gap-2 lg:overflow-y-auto lg:pr-1">
          {isLoading ? (
            <div className="flex flex-col gap-2">
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
            </div>
          ) : !modules || modules.length === 0 ? (
            <EmptyState icon={Layers} title="No outline yet" description="This course doesn't have a structure yet." />
          ) : (
            modules.map((module) => (
              <Card key={module.id} padding="sm">
                <p className="text-sm font-semibold text-fg">{module.title}</p>
                {module.lessons.length === 0 ? (
                  <p className="mt-1 text-xs text-muted">No lessons yet.</p>
                ) : (
                  <div className="mt-2 flex flex-col gap-2">
                    {module.lessons.map((lesson) => (
                      <div key={lesson.id}>
                        <p className="text-sm text-fg">{lesson.title}</p>
                        {lesson.keyTopics.length > 0 ? (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {lesson.keyTopics.map((topic) => (
                              <Badge key={topic} variant="primary">
                                {topic}
                              </Badge>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            ))
          )}
        </div>

        <TutorPanel courseId={courseId} />
      </div>
    </AppShell>
  );
};
