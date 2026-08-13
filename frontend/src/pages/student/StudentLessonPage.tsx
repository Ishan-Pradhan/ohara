import { useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';

import { useOutline } from '../../features/tutor/useTutor.js';
import { AppShell } from '../../components/layout/AppShell.js';
import { Skeleton } from '../../components/ui/Skeleton.js';
import { Button } from '../../components/ui/Button.js';
import { LessonReader } from '../../components/course-content/LessonReader.js';
import { StudyAidsPanel } from '../../components/studyAids/StudyAidsPanel.js';
import { cn } from '../../lib/cn.js';

export const StudentLessonPage = () => {
  const { courseId = '', lessonId = '' } = useParams();
  const navigate = useNavigate();
  const { data: modules, isLoading } = useOutline(courseId);

  const flattened = (modules ?? []).flatMap((m) =>
    m.lessons.map((l) => ({ ...l, moduleTitle: m.title })),
  );
  const index = flattened.findIndex((l) => l.id === lessonId);
  const lesson = index >= 0 ? flattened[index] : undefined;
  const prev = index > 0 ? flattened[index - 1] : undefined;
  const next = index >= 0 && index < flattened.length - 1 ? flattened[index + 1] : undefined;

  return (
    <AppShell>
      <button
        type="button"
        onClick={() => navigate(`/student/courses/${courseId}`)}
        className="mb-4 flex items-center gap-1 text-sm text-muted hover:text-fg"
      >
        <ChevronLeft className="size-3.5" aria-hidden />
        Back to course
      </button>

      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : !lesson ? (
        <p className="text-sm text-muted">Lesson not found.</p>
      ) : (
        <>
          <LessonReader
            moduleTitle={lesson.moduleTitle}
            title={lesson.title}
            content={lesson.content}
            keyTopics={lesson.keyTopics}
            footer={
              <div
                className={cn(
                  'flex items-center gap-3',
                  prev && next ? 'justify-between' : next ? 'justify-end' : 'justify-start',
                )}
              >
                {prev ? (
                  <Button
                    variant="secondary"
                    onClick={() => navigate(`/student/courses/${courseId}/lessons/${prev.id}`)}
                  >
                    <ChevronLeft className="size-4" aria-hidden />
                    {prev.title}
                  </Button>
                ) : null}
                {next ? (
                  <Button
                    variant="secondary"
                    onClick={() => navigate(`/student/courses/${courseId}/lessons/${next.id}`)}
                  >
                    {next.title}
                    <ChevronRight className="size-4" aria-hidden />
                  </Button>
                ) : null}
              </div>
            }
          />

          <div className="mx-auto mt-10 max-w-3xl border-t border-border pt-8">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-subtle">
              Study tools for this lesson
            </h2>
            <StudyAidsPanel courseId={courseId} lessonId={lessonId} />
          </div>
        </>
      )}
    </AppShell>
  );
};
