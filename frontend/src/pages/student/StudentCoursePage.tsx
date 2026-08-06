import { Link, useParams } from 'react-router-dom';
import {
  BarChart3,
  CalendarCheck,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  HelpCircle,
  Layers,
  MessageCircle,
} from 'lucide-react';

import { useCurrentUser } from '../../features/auth/useAuth.js';
import { useStudentPlacement } from '../../features/placement/usePlacement.js';
import { useOutline } from '../../features/tutor/useTutor.js';
import { AppShell } from '../../components/layout/AppShell.js';
import { PageHeader } from '../../components/layout/PageHeader.js';
import { Card } from '../../components/ui/Card.js';
import { Badge } from '../../components/ui/Badge.js';
import { Skeleton } from '../../components/ui/Skeleton.js';
import { EmptyState } from '../../components/ui/EmptyState.js';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../components/ui/Tabs.js';
import { TutorPanel } from './TutorPanel.js';
import { StudentAssignmentsSection } from './StudentAssignmentsSection.js';
import { StudentQuizzesSection } from './StudentQuizzesSection.js';
import { StudentGradesSection } from './StudentGradesSection.js';
import { StudentAttendanceSection } from './StudentAttendanceSection.js';

export const StudentCoursePage = () => {
  const { courseId = '' } = useParams();
  const { data: currentUser } = useCurrentUser();
  const studentId = currentUser?.id ?? '';
  const { data: placement } = useStudentPlacement(studentId);
  const course = placement?.courses.find((c) => c.id === courseId);
  // No point requesting an outline the course isn't published enough to have
  // — it would just 404. course.isPublished is already known from placement.
  const { data: modules, isLoading } = useOutline(course?.isPublished ? courseId : '');

  return (
    <AppShell>
      <Link
        to="/student/courses"
        className="mb-1 flex items-center gap-1 text-sm text-muted hover:text-fg"
      >
        <ChevronLeft className="size-3.5" aria-hidden />
        My Courses
      </Link>

      <PageHeader
        title={course?.title ?? 'Course'}
        description={course?.code}
        actions={
          course && !course.isPublished ? <Badge variant="warning">Not published yet</Badge> : undefined
        }
      />

      <Tabs defaultValue="learn">
        <TabsList>
          <TabsTrigger value="learn">
            <MessageCircle className="size-4" aria-hidden />
            Learn
          </TabsTrigger>
          <TabsTrigger value="assignments">
            <ClipboardList className="size-4" aria-hidden />
            Assignments
          </TabsTrigger>
          <TabsTrigger value="quizzes">
            <HelpCircle className="size-4" aria-hidden />
            Quizzes
          </TabsTrigger>
          <TabsTrigger value="grades">
            <BarChart3 className="size-4" aria-hidden />
            Grades
          </TabsTrigger>
          <TabsTrigger value="attendance">
            <CalendarCheck className="size-4" aria-hidden />
            Attendance
          </TabsTrigger>
        </TabsList>

        <TabsContent value="learn">
          <div className="grid grid-cols-1 gap-6 lg:h-[calc(100dvh-18rem)] lg:grid-cols-[280px_1fr]">
            <div className="flex flex-col gap-2 lg:overflow-y-auto lg:pr-1">
              {!course?.isPublished ? (
                <EmptyState
                  icon={Layers}
                  title="Not published yet"
                  description="Your teacher is still preparing this course's material — check back soon. You can still ask the tutor questions in the meantime."
                />
              ) : isLoading ? (
                <div className="flex flex-col gap-2">
                  <Skeleton className="h-14 w-full" />
                  <Skeleton className="h-14 w-full" />
                </div>
              ) : !modules || modules.length === 0 ? (
                <EmptyState icon={Layers} title="No lessons yet" description="Your teacher hasn't added any lessons to this course yet." />
              ) : (
                modules.map((module) => (
                  <Card key={module.id} padding="sm">
                    <p className="text-sm font-semibold text-fg">{module.title}</p>
                    {module.lessons.length === 0 ? (
                      <p className="mt-1 text-xs text-muted">No lessons yet.</p>
                    ) : (
                      <div className="mt-2 flex flex-col gap-1">
                        {module.lessons.map((lesson) => (
                          <Link
                            key={lesson.id}
                            to={`/student/courses/${courseId}/lessons/${lesson.id}`}
                            className="flex items-center justify-between gap-2 rounded-control px-2 py-1.5 transition-colors hover:bg-surface-hover"
                          >
                            <div className="min-w-0">
                              <p className="truncate text-sm text-fg">{lesson.title}</p>
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
                            <ChevronRight className="size-4 shrink-0 text-subtle" aria-hidden />
                          </Link>
                        ))}
                      </div>
                    )}
                  </Card>
                ))
              )}
            </div>

            <TutorPanel courseId={courseId} />
          </div>
        </TabsContent>

        <TabsContent value="assignments">
          <StudentAssignmentsSection courseId={courseId} />
        </TabsContent>

        <TabsContent value="quizzes">
          <StudentQuizzesSection courseId={courseId} />
        </TabsContent>

        <TabsContent value="grades">
          <StudentGradesSection courseId={courseId} />
        </TabsContent>

        <TabsContent value="attendance">
          <StudentAttendanceSection courseId={courseId} />
        </TabsContent>
      </Tabs>
    </AppShell>
  );
};
