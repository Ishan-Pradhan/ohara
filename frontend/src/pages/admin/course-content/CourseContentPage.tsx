import { Link, useParams } from 'react-router-dom';
import { BarChart3, BookOpen, CalendarCheck, ChevronLeft, ChevronRight, ClipboardList, HelpCircle } from 'lucide-react';

import {
  useClasses,
  useCourses,
  usePrograms,
} from '../../../features/institution/useInstitution.js';
import { usePublishCourse } from '../../../features/courseContent/useCourseContent.js';
import { useMyCourses } from '../../../features/teacher/useTeacher.js';
import { useCurrentUser } from '../../../features/auth/useAuth.js';
import { toast } from '../../../lib/toast.js';
import { AppShell } from '../../../components/layout/AppShell.js';
import { PageHeader } from '../../../components/layout/PageHeader.js';
import { Badge } from '../../../components/ui/Badge.js';
import { Switch } from '../../../components/ui/Switch.js';
import { Skeleton } from '../../../components/ui/Skeleton.js';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../../components/ui/Tabs.js';
import { DocumentsSection } from './DocumentsSection.js';
import { ModulesSection } from './ModulesSection.js';
import { AssignmentsSection } from './AssignmentsSection.js';
import { QuizzesSection } from './QuizzesSection.js';
import { GradebookSection } from './GradebookSection.js';
import { AttendanceSection } from './AttendanceSection.js';

export const CourseContentPage = () => {
  const { courseId = '' } = useParams();
  const { data: currentUser } = useCurrentUser();
  const isAdmin = currentUser?.role === 'admin';

  // A teacher can't reach /admin/programs or /admin/classes (admin-only),
  // so the breadcrumb below and the course lookup itself branch on role —
  // teachers resolve their course from /teacher/courses instead.
  const { data: adminCourses, isLoading: adminCoursesLoading } = useCourses();
  const { data: classes, isLoading: classesLoading } = useClasses();
  const { data: programs, isLoading: programsLoading } = usePrograms();
  const { data: myCourses, isLoading: myCoursesLoading } = useMyCourses();

  const course = isAdmin
    ? adminCourses?.find((c) => c.id === courseId)
    : myCourses?.find((c) => c.id === courseId);
  const cls = isAdmin ? classes?.find((c) => c.id === course?.classId) : undefined;
  const program = isAdmin ? programs?.find((p) => p.id === cls?.programId) : undefined;
  const publishCourse = usePublishCourse(courseId);

  const isLoading = isAdmin
    ? adminCoursesLoading || classesLoading || programsLoading
    : myCoursesLoading;

  const onTogglePublish = async (checked: boolean) => {
    await publishCourse.mutateAsync(checked);
    toast.success(checked ? 'Course published' : 'Course unpublished');
  };

  return (
    <AppShell>
      {isAdmin ? (
        <div className="mb-1 flex items-center gap-1.5 text-sm text-muted">
          <Link to="/admin/structure" className="hover:text-fg hover:underline">
            Structure
          </Link>
          <ChevronRight className="size-3.5" aria-hidden />
          {program ? (
            <Link
              to={`/admin/structure/${program.id}`}
              className="hover:text-fg hover:underline"
            >
              {program.name}
            </Link>
          ) : (
            <span>…</span>
          )}
          <ChevronRight className="size-3.5" aria-hidden />
          {program && cls ? (
            <Link
              to={`/admin/structure/${program.id}/${cls.id}`}
              className="hover:text-fg hover:underline"
            >
              {cls.name}
            </Link>
          ) : (
            <span>…</span>
          )}
          <ChevronRight className="size-3.5" aria-hidden />
          <span className="text-fg">{course?.title ?? '…'}</span>
        </div>
      ) : (
        <Link
          to="/teacher/courses"
          className="mb-1 flex items-center gap-1 text-sm text-muted hover:text-fg"
        >
          <ChevronLeft className="size-3.5" aria-hidden />
          My Courses
        </Link>
      )}

      {isLoading ? (
        <Skeleton className="h-10 w-64" />
      ) : (
        <PageHeader
          title={course ? course.title : 'Course content'}
          description={course ? `${course.code} — documents, modules, and lessons.` : undefined}
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

      <Tabs defaultValue="content">
        <TabsList>
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
        </TabsList>

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
      </Tabs>
    </AppShell>
  );
};
