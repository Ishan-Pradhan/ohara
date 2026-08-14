import { useState } from 'react';
import { HelpCircle, Layers, Sparkles } from 'lucide-react';

import { useOutline } from '../../features/tutor/useTutor.js';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../ui/Tabs.js';
import { Select } from '../ui/Select.js';
import { SummarySection } from './SummarySection.js';
import { FlashcardsSection } from './FlashcardsSection.js';
import { ExplainConceptSection } from './ExplainConceptSection.js';

const WHOLE_COURSE = '__course__';

interface StudyAidsPanelProps {
  courseId: string;
  /** Seeds the scope picker below when opened from a specific lesson's page
   * (e.g. StudentLessonPage) — the student can still switch to any other
   * lesson, or the whole course, without leaving this panel. Omit to start
   * scoped to the whole course (e.g. StudentCoursePage). */
  initialLessonId?: string;
}

/** Student self-study tools grounded in the course material: an AI summary,
 * a flashcard set, and a free-text "explain this concept" lookup. Each is
 * scoped to whichever lesson (or the whole course) is picked below — a
 * student isn't stuck with whatever scope the panel happened to open with. */
export const StudyAidsPanel = ({ courseId, initialLessonId }: StudyAidsPanelProps) => {
  const [scope, setScope] = useState(initialLessonId ?? WHOLE_COURSE);
  const lessonId = scope === WHOLE_COURSE ? undefined : scope;

  const { data: modules } = useOutline(courseId);
  const lessons = (modules ?? []).flatMap((m) =>
    m.lessons.map((l) => ({ ...l, moduleTitle: m.title })),
  );
  const scopeOptions = [
    { value: WHOLE_COURSE, label: 'Whole course' },
    ...lessons.map((l) => ({ value: l.id, label: `${l.moduleTitle} — ${l.title}` })),
  ];

  return (
    <div className="flex flex-col gap-4">
      {lessons.length > 0 ? (
        <div className="flex flex-col gap-1.5 sm:w-72">
          <label className="text-xs font-medium text-muted uppercase tracking-wide">Scope</label>
          <Select value={scope} onValueChange={setScope} options={scopeOptions} />
        </div>
      ) : null}

      <Tabs defaultValue="summary">
        <TabsList>
          <TabsTrigger value="summary">
            <Sparkles className="size-4" aria-hidden />
            Summary
          </TabsTrigger>
          <TabsTrigger value="flashcards">
            <Layers className="size-4" aria-hidden />
            Flashcards
          </TabsTrigger>
          <TabsTrigger value="explain">
            <HelpCircle className="size-4" aria-hidden />
            Explain a concept
          </TabsTrigger>
        </TabsList>

        <TabsContent value="summary">
          <SummarySection courseId={courseId} lessonId={lessonId} />
        </TabsContent>
        <TabsContent value="flashcards">
          <FlashcardsSection courseId={courseId} lessonId={lessonId} />
        </TabsContent>
        <TabsContent value="explain">
          <ExplainConceptSection courseId={courseId} lessonId={lessonId} />
        </TabsContent>
      </Tabs>
    </div>
  );
};
