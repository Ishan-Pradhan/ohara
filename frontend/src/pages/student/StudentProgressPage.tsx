import { Brain, CalendarDays, FlaskConical, Microscope, Shield } from 'lucide-react';

import { AppShell } from '../../components/layout/AppShell.js';
import { PageHeader } from '../../components/layout/PageHeader.js';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../components/ui/Tabs.js';
import { LearningProfileCard } from './LearningProfileCard.js';
import { ConceptMasteryCard } from './ConceptMasteryCard.js';
import { MasteryReportCard } from './MasteryReportCard.js';
import { StudyPlanCard } from './StudyPlanCard.js';
import { ExamPrepCard } from './ExamPrepCard.js';

export const StudentProgressPage = () => (
  <AppShell>
    <PageHeader
      title="My Progress"
      description="Performance, concept coverage, exam readiness, and your AI study plan."
    />
    <Tabs defaultValue="overview">
      <TabsList>
        <TabsTrigger value="overview">
          <Brain className="size-3.5" aria-hidden />
          Overview
        </TabsTrigger>
        <TabsTrigger value="concepts">
          <FlaskConical className="size-3.5" aria-hidden />
          Concepts
        </TabsTrigger>
        <TabsTrigger value="mastery">
          <Microscope className="size-3.5" aria-hidden />
          Mastery
        </TabsTrigger>
        <TabsTrigger value="exam-prep">
          <Shield className="size-3.5" aria-hidden />
          Exam prep
        </TabsTrigger>
        <TabsTrigger value="study-plan">
          <CalendarDays className="size-3.5" aria-hidden />
          Study plan
        </TabsTrigger>
      </TabsList>

      <TabsContent value="overview">
        <LearningProfileCard />
      </TabsContent>

      <TabsContent value="concepts">
        <ConceptMasteryCard />
      </TabsContent>

      <TabsContent value="mastery">
        <MasteryReportCard />
      </TabsContent>

      <TabsContent value="exam-prep">
        <ExamPrepCard />
      </TabsContent>

      <TabsContent value="study-plan">
        <StudyPlanCard />
      </TabsContent>
    </Tabs>
  </AppShell>
);
