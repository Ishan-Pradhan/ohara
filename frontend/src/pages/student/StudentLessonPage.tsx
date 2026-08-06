import { useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';

import { useOutline } from '../../features/tutor/useTutor.js';
import { AppShell } from '../../components/layout/AppShell.js';
import { Skeleton } from '../../components/ui/Skeleton.js';
import { Button } from '../../components/ui/Button.js';
import { LessonReader } from '../../components/course-content/LessonReader.js';

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
        <LessonReader
          moduleTitle={lesson.moduleTitle}
          title={lesson.title}
          content={lesson.content}
          keyTopics={lesson.keyTopics}
          footer={
            <div className="flex items-center justify-between gap-3">
              {prev ? (
                <Button
                  variant="secondary"
                  onClick={() => navigate(`/student/courses/${courseId}/lessons/${prev.id}`)}
                >
                  <ChevronLeft className="size-4" aria-hidden />
                  {prev.title}
                </Button>
              ) : (
                <span />
              )}
              {next ? (
                <Button
                  variant="secondary"
                  onClick={() => navigate(`/student/courses/${courseId}/lessons/${next.id}`)}
                >
                  {next.title}
                  <ChevronRight className="size-4" aria-hidden />
                </Button>
              ) : (
                <span />
              )}
            </div>
          }
        />
      )}
    </AppShell>
  );
};
