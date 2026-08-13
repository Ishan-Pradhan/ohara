import { AppShell } from '../../components/layout/AppShell.js';
import { PageHeader } from '../../components/layout/PageHeader.js';
import { StudyPlanCard } from './StudyPlanCard.js';

export const StudentStudyPlanPage = () => (
  <AppShell>
    <PageHeader
      title="My Study Plan"
      description="Your AI-generated weekly study plan, built from what's due and where you're behind."
    />
    <StudyPlanCard />
  </AppShell>
);
