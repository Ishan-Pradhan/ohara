import { Link, useParams } from 'react-router-dom';
import { ChevronRight, FileText, Layers } from 'lucide-react';

import { useCurrentUser } from '../../features/auth/useAuth.js';
import { useStudentPlacement } from '../../features/placement/usePlacement.js';
import { useOutline } from '../../features/tutor/useTutor.js';
import { useViewableDocuments } from '../../features/documents/useDocuments.js';
import { documentFileUrl } from '../../features/documents/documents.api.js';
import { AppShell } from '../../components/layout/AppShell.js';
import { Card } from '../../components/ui/Card.js';
import { Badge } from '../../components/ui/Badge.js';
import { Skeleton } from '../../components/ui/Skeleton.js';
import { EmptyState } from '../../components/ui/EmptyState.js';
import { TutorPanel } from './TutorPanel.js';
import { StudyAidsPanel } from '../../components/studyAids/StudyAidsPanel.js';
import { StudentAssignmentsSection } from './StudentAssignmentsSection.js';
import { StudentQuizzesSection } from './StudentQuizzesSection.js';
import { StudentGradesSection } from './StudentGradesSection.js';
import { StudentAttendanceSection } from './StudentAttendanceSection.js';
import { CourseHeader } from './CourseHeader.js';
import { StudentCourseSectionNav } from './StudentCourseSectionNav.js';

const SECTIONS = ['content', 'tutor', 'study-tools', 'assignments', 'quizzes', 'grades', 'attendance'] as const;
type Section = (typeof SECTIONS)[number];

const isSection = (value: string | undefined): value is Section =>
  Boolean(value) && (SECTIONS as readonly string[]).includes(value!);

export const StudentCoursePage = () => {
  const { courseId = '', section: rawSection } = useParams();
  const section: Section = isSection(rawSection) ? rawSection : 'content';

  const { data: currentUser } = useCurrentUser();
  const studentId = currentUser?.id ?? '';
  const { data: placement } = useStudentPlacement(studentId);
  const course = placement?.courses.find((c) => c.id === courseId);
  const { data: modules, isLoading } = useOutline(course?.isPublished && section === 'content' ? courseId : '');
  const { data: documents, isLoading: documentsLoading } = useViewableDocuments(
    course?.isPublished && section === 'content' ? courseId : '',
  );

  const renderSection = () => {
    switch (section) {
      case 'content':
        return !course?.isPublished ? (
          <EmptyState
            icon={Layers}
            title="Not published yet"
            description="Your teacher is still preparing this course's material — check back soon. You can still ask the tutor questions in the meantime."
          />
        ) : isLoading || documentsLoading ? (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </div>
        ) : (!modules || modules.length === 0) && (!documents || documents.length === 0) ? (
          <EmptyState icon={Layers} title="No content yet" description="Your teacher hasn't added any material to this course yet." />
        ) : (
          <div className="flex flex-col gap-6">
            {documents && documents.length > 0 ? (
              <div className="flex flex-col gap-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-subtle">Course material</p>
                <div className="flex flex-col gap-1.5">
                  {documents.map((document) => (
                    <a
                      key={document.id}
                      href={documentFileUrl(courseId, document.id)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between gap-2 rounded-control border border-border bg-surface px-3 py-2.5 transition-colors hover:border-primary/30 hover:bg-surface-hover"
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <FileText className="size-4 shrink-0 text-subtle" aria-hidden />
                        <p className="truncate text-sm font-medium text-fg">{document.filename}</p>
                      </div>
                      <ChevronRight className="size-4 shrink-0 text-subtle" aria-hidden />
                    </a>
                  ))}
                </div>
              </div>
            ) : null}
            {modules && modules.length > 0 ? (
              <div className="flex flex-col gap-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-subtle">Course outline</p>
                <div className="flex flex-col gap-3">
                  {modules.map((module) => (
                    <Card key={module.id}>
                      <p className="text-sm font-semibold text-fg">{module.title}</p>
                      {module.lessons.length === 0 ? (
                        <p className="mt-1 text-xs text-muted">No lessons yet.</p>
                      ) : (
                        <div className="mt-3 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                          {module.lessons.map((lesson) => (
                            <Link
                              key={lesson.id}
                              to={`/student/courses/${courseId}/lessons/${lesson.id}`}
                              className="flex items-center justify-between gap-2 rounded-control border border-border px-3 py-2 transition-colors hover:border-primary/30 hover:bg-surface-hover"
                            >
                              <div className="min-w-0">
                                <p className="truncate text-sm text-fg">{lesson.title}</p>
                                {lesson.keyTopics.length > 0 ? (
                                  <div className="mt-1 flex flex-wrap gap-1">
                                    {lesson.keyTopics.slice(0, 3).map((topic) => (
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
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        );
      case 'tutor':
        return <TutorPanel courseId={courseId} />;
      case 'study-tools':
        return <StudyAidsPanel courseId={courseId} />;
      case 'assignments':
        return <StudentAssignmentsSection courseId={courseId} />;
      case 'quizzes':
        return <StudentQuizzesSection courseId={courseId} />;
      case 'grades':
        return <StudentGradesSection courseId={courseId} />;
      case 'attendance':
        return <StudentAttendanceSection courseId={courseId} />;
    }
  };

  return (
    <AppShell>
      <CourseHeader
        title={course?.title ?? 'Course'}
        code={course?.code ?? ''}
        isPublished={course?.isPublished ?? false}
        teachers={course?.teachers ?? []}
      />

      <div className="flex flex-col gap-6 md:flex-row">
        <div className="shrink-0 md:w-56">
          <StudentCourseSectionNav courseId={courseId} />
        </div>
        <div className="min-w-0 flex-1">{renderSection()}</div>
      </div>
    </AppShell>
  );
};
