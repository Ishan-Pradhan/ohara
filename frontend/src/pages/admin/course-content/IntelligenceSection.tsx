import { BarChart3, MessageSquare, AlertTriangle, BookOpen, Calendar } from 'lucide-react';

import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../../components/ui/Tabs.js';
import { ClassIntelligenceCard } from './ClassIntelligenceCard.js';
import { CopilotPanel } from './CopilotPanel.js';
import { InterventionPanel } from './InterventionPanel.js';
import { LessonPlannerPanel } from './LessonPlannerPanel.js';
import { WeeklyIntelligencePanel } from './WeeklyIntelligencePanel.js';

interface IntelligenceSectionProps {
  courseId: string;
}

export const IntelligenceSection = ({ courseId }: IntelligenceSectionProps) => {
  return (
    <Tabs defaultValue="overview">
      <TabsList>
        <TabsTrigger value="overview">
          <BarChart3 className="size-4" aria-hidden />
          Overview
        </TabsTrigger>
        <TabsTrigger value="weekly">
          <Calendar className="size-4" aria-hidden />
          Weekly
        </TabsTrigger>
        <TabsTrigger value="copilot">
          <MessageSquare className="size-4" aria-hidden />
          AI Copilot
        </TabsTrigger>
        <TabsTrigger value="interventions">
          <AlertTriangle className="size-4" aria-hidden />
          Interventions
        </TabsTrigger>
        <TabsTrigger value="lesson-planner">
          <BookOpen className="size-4" aria-hidden />
          Lesson Planner
        </TabsTrigger>
      </TabsList>

      <TabsContent value="overview">
        <ClassIntelligenceCard courseId={courseId} />
      </TabsContent>

      <TabsContent value="weekly">
        <WeeklyIntelligencePanel courseId={courseId} />
      </TabsContent>

      <TabsContent value="copilot">
        <CopilotPanel courseId={courseId} />
      </TabsContent>

      <TabsContent value="interventions">
        <InterventionPanel courseId={courseId} />
      </TabsContent>

      <TabsContent value="lesson-planner">
        <LessonPlannerPanel courseId={courseId} />
      </TabsContent>
    </Tabs>
  );
};
