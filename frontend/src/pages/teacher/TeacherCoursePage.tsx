import { Link, useParams } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';

import { useMyCourses } from '../../features/teacher/useTeacher.js';
import { usePublishCourse } from '../../features/courseContent/useCourseContent.js';
import { toast } from '../../lib/toast.js';
import { AppShell } from '../../components/layout/AppShell.js';
import { Badge } from '../../components/ui/Badge.js';
import { Switch } from '../../components/ui/Switch.js';
import { Skeleton } from '../../components/ui/Skeleton.js';
import { DocumentsSection } from '../admin/course-content/DocumentsSection.js';
import { ModulesSection } from '../admin/course-content/ModulesSection.js';
import { AssignmentsSection } from '../admin/course-content/AssignmentsSection.js';
import { QuizzesSection } from '../admin/course-content/QuizzesSection.js';
import { GradebookSection } from '../admin/course-content/GradebookSection.js';
import { AttendanceSection } from '../admin/course-content/AttendanceSection.js';
import { ClassIntelligenceCard } from '../admin/course-content/ClassIntelligenceCard.js';
import { CopilotPanel } from '../admin/course-content/CopilotPanel.js';
import { InterventionPanel } from '../admin/course-content/InterventionPanel.js';
import { LessonPlannerPanel } from '../admin/course-content/LessonPlannerPanel.js';
import { WeeklyIntelligencePanel } from '../admin/course-content/WeeklyIntelligencePanel.js';
import { TeacherOverviewSection } from './TeacherOverviewSection.js';
import { CourseSectionNav } from './CourseSectionNav.js';

const SECTIONS = ['overview', 'content', 'assignments', 'quizzes', 'gradebook', 'attendance', 'intelligence'] as const;
type Section = (typeof SECTIONS)[number];

const INTELLIGENCE_SUBSECTIONS = ['weekly', 'copilot', 'interventions', 'lesson-planner'] as const;
type IntelligenceSubsection = (typeof INTELLIGENCE_SUBSECTIONS)[number];

const isSection = (value: string | undefined): value is Section =>
  Boolean(value) && (SECTIONS as readonly string[]).includes(value!);

const isIntelligenceSubsection = (value: string | undefined): value is IntelligenceSubsection =>
  Boolean(value) && (INTELLIGENCE_SUBSECTIONS as readonly string[]).includes(value!);

export const TeacherCoursePage = () => {
  const { courseId = '', section: rawSection, subsection: rawSubsection } = useParams();
  const { data: courses, isLoading } = useMyCourses();
  const course = courses?.find((c) => c.id === courseId);
  const publishCourse = usePublishCourse(courseId);

  const section: Section = rawSubsection !== undefined ? 'intelligence' : isSection(rawSection) ? rawSection : 'overview';
  const intelligenceSubsection = isIntelligenceSubsection(rawSubsection) ? rawSubsection : null;

  const onTogglePublish = async (checked: boolean) => {
    await publishCourse.mutateAsync(checked);
    toast.success(checked ? 'Course published' : 'Course unpublished');
  };

  const renderSection = () => {
    switch (section) {
      case 'overview':
        return <TeacherOverviewSection courseId={courseId} />;
      case 'content':
        return (
          <div className="flex flex-col gap-10">
            <DocumentsSection
              courseId={courseId}
              knowledgeBaseDocumentId={course?.knowledgeBaseDocumentId ?? null}
              syllabusDocumentId={course?.syllabusDocumentId ?? null}
            />
            <ModulesSection courseId={courseId} />
          </div>
        );
      case 'assignments':
        return <AssignmentsSection courseId={courseId} />;
      case 'quizzes':
        return <QuizzesSection courseId={courseId} />;
      case 'gradebook':
        return <GradebookSection courseId={courseId} />;
      case 'attendance':
        return <AttendanceSection courseId={courseId} />;
      case 'intelligence':
        switch (intelligenceSubsection) {
          case 'weekly':
            return <WeeklyIntelligencePanel courseId={courseId} />;
          case 'copilot':
            return <CopilotPanel courseId={courseId} />;
          case 'interventions':
            return <InterventionPanel courseId={courseId} />;
          case 'lesson-planner':
            return <LessonPlannerPanel courseId={courseId} />;
          default:
            return <ClassIntelligenceCard courseId={courseId} />;
        }
    }
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
        <div className="mb-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-xl font-semibold text-fg">{course?.title ?? 'Course'}</h1>
              <p className="mt-0.5 text-sm text-muted">
                {course ? `${course.code}${course.className ? ` — ${course.className}` : ''}` : undefined}
              </p>
            </div>
            {course ? (
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
            ) : null}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-6 md:flex-row">
        <div className="shrink-0 md:w-56">
          <CourseSectionNav courseId={courseId} />
        </div>
        <div className="min-w-0 flex-1">{renderSection()}</div>
      </div>
    </AppShell>
  );
};
