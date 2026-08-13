import { Bot, Building2, Calendar, LayoutGrid } from 'lucide-react';
import { AppShell } from '../../components/layout/AppShell.js';
import { PageHeader } from '../../components/layout/PageHeader.js';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../components/ui/Tabs.js';
import { InstitutionOverviewTab, InstitutionProgramsTab } from './InstitutionPerformancePage.js';
import { InstitutionWeeklyPage } from './InstitutionWeeklyPage.js';
import { AdminCopilotPanel } from '../../features/institution/AdminCopilotPanel.js';

export const AdminAnalyticsPage = () => {
  return (
    <AppShell>
      <PageHeader
        title="Analytics"
        description="Institution-wide performance metrics, weekly intelligence, and the academic copilot."
      />

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">
            <Building2 className="size-4" aria-hidden />
            Overview
          </TabsTrigger>
          <TabsTrigger value="programs">
            <LayoutGrid className="size-4" aria-hidden />
            Programs & Courses
          </TabsTrigger>
          <TabsTrigger value="weekly">
            <Calendar className="size-4" aria-hidden />
            Weekly
          </TabsTrigger>
          <TabsTrigger value="copilot">
            <Bot className="size-4" aria-hidden />
            Copilot
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <InstitutionOverviewTab />
        </TabsContent>

        <TabsContent value="programs">
          <InstitutionProgramsTab />
        </TabsContent>

        <TabsContent value="weekly">
          <InstitutionWeeklyPage />
        </TabsContent>

        <TabsContent value="copilot">
          <AdminCopilotPanel />
        </TabsContent>
      </Tabs>
    </AppShell>
  );
};
