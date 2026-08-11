import { Link, useParams } from 'react-router-dom';
import { ChevronLeft, BookOpen, ClipboardList, HelpCircle, BarChart3, CalendarCheck, Brain } from 'lucide-react';

import { useMyCourses } from '../../features/teacher/useTeacher.js';
import { usePublishCourse } from '../../features/courseContent/useCourseContent.js';
import { toast } from '../../lib/toast.js';
import { AppShell } from '../../components/layout/AppShell.js';
import { PageHeader } from '../../components/layout/PageHeader.js';
import { Badge } from '../../components/ui/Badge.js';
import { Switch } from '../../components/ui/Switch.js';
import { Skeleton } from '../../components/ui/Skeleton.js';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../components/ui/Tabs.js';
import { DocumentsSection } from '../admin/course-content/DocumentsSection.js';
import { ModulesSection } from '../admin/course-content/ModulesSection.js';
import { AssignmentsSection } from '../admin/course-content/AssignmentsSection.js';
import { QuizzesSection } from '../admin/course-content/QuizzesSection.js';
import { GradebookSection } from '../admin/course-content/GradebookSection.js';
import { AttendanceSection } from '../admin/course-content/AttendanceSection.js';
import { IntelligenceSection } from '../admin/course-content/IntelligenceSection.js';
import { TeacherOverviewSection } from './TeacherOverviewSection.js';

export const TeacherCoursePage = () => {
  const { courseId = '' } = useParams();
  const { data: courses, isLoading } = useMyCourses();
  const course = courses?.find((c) => c.id === courseId);
  const publishCourse = usePublishCourse(courseId);

  const onTogglePublish = async (checked: boolean) => {
    await publishCourse.mutateAsync(checked);
    toast.success(checked ? 'Course published' : 'Course unpublished');
  };

  return (
    <AppShell>
      <Link
        to="/teacher/courses"
        className="mb-1 flex items-center gap-1 text-sm text-muted hover:text-fg"
      >
        <ChevronLeft className="size-3.5" aria-hidden />
        My Courses
      </Link>

      {isLoading ? (
        <Skeleton className="h-10 w-64" />
      ) : (
        <PageHeader
          title={course?.title ?? 'Course'}
          description={course ? `${course.code}${course.className ? ` — ${course.className}` : ''}` : undefined}
          actions={
            course ? (
              <div className="flex items-center gap-3">
                <Badge variant={course.isPublished ? 'success' : 'neutral'}>
                  {course.isPublished ? 'Published' : 'Draft'}
                </Badge>
                <Switch
                  checked={course.isPublished}
                  onCheckedChange={onTogglePublish}
                  disabled={publishCourse.isPending}
                  id="publish-toggle"
                />
              </div>
            ) : undefined
          }
        />
      )}

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">
            <BarChart3 className="size-4" aria-hidden />
            Overview
          </TabsTrigger>
          <TabsTrigger value="content">
            <BookOpen className="size-4" aria-hidden />
            Content
          </TabsTrigger>
          <TabsTrigger value="assignments">
            <ClipboardList className="size-4" aria-hidden />
            Assignments
          </TabsTrigger>
          <TabsTrigger value="quizzes">
            <HelpCircle className="size-4" aria-hidden />
            Quizzes
          </TabsTrigger>
          <TabsTrigger value="gradebook">
            <BarChart3 className="size-4" aria-hidden />
            Gradebook
          </TabsTrigger>
          <TabsTrigger value="attendance">
            <CalendarCheck className="size-4" aria-hidden />
            Attendance
          </TabsTrigger>
          <TabsTrigger value="intelligence">
            <Brain className="size-4" aria-hidden />
            Intelligence
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <TeacherOverviewSection courseId={courseId} />
        </TabsContent>

        <TabsContent value="content">
          <div className="flex flex-col gap-10">
            <DocumentsSection courseId={courseId} />
            <ModulesSection courseId={courseId} />
          </div>
        </TabsContent>

        <TabsContent value="assignments">
          <AssignmentsSection courseId={courseId} />
        </TabsContent>

        <TabsContent value="quizzes">
          <QuizzesSection courseId={courseId} />
        </TabsContent>

        <TabsContent value="gradebook">
          <GradebookSection courseId={courseId} />
        </TabsContent>

        <TabsContent value="attendance">
          <AttendanceSection courseId={courseId} />
        </TabsContent>

        <TabsContent value="intelligence">
          <IntelligenceSection courseId={courseId} />
        </TabsContent>
      </Tabs>
    </AppShell>
  );
};
