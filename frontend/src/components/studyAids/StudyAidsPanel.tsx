import { HelpCircle, Layers, Sparkles } from 'lucide-react';

import { Tabs, TabsList, TabsTrigger, TabsContent } from '../ui/Tabs.js';
import { SummarySection } from './SummarySection.js';
import { FlashcardsSection } from './FlashcardsSection.js';
import { ExplainConceptSection } from './ExplainConceptSection.js';

interface StudyAidsPanelProps {
  courseId: string;
  /** Omit for course-wide study aids; pass to scope every section to one lesson. */
  lessonId?: string;
}

/** Student self-study tools grounded in the course material: an AI summary,
 * a flashcard set, and a free-text "explain this concept" lookup — each
 * scoped to a single lesson when `lessonId` is given, or to the whole
 * course otherwise. */
export const StudyAidsPanel = ({ courseId, lessonId }: StudyAidsPanelProps) => (
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
);
