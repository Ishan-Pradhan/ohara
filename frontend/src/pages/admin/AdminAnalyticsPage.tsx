import { Building2, Calendar } from 'lucide-react';
import { AppShell } from '../../components/layout/AppShell.js';
import { PageHeader } from '../../components/layout/PageHeader.js';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../components/ui/Tabs.js';
import { InstitutionPerformancePage } from './InstitutionPerformancePage.js';
import { InstitutionWeeklyPage } from './InstitutionWeeklyPage.js';

export const AdminAnalyticsPage = () => {
  return (
    <AppShell>
      <PageHeader
        title="Analytics"
        description="Institution-wide performance metrics and weekly intelligence."
      />

      <Tabs defaultValue="performance">
        <TabsList>
          <TabsTrigger value="performance">
            <Building2 className="size-4" aria-hidden />
            Performance
          </TabsTrigger>
          <TabsTrigger value="weekly">
            <Calendar className="size-4" aria-hidden />
            Weekly
          </TabsTrigger>
        </TabsList>

        <TabsContent value="performance">
          <InstitutionPerformancePage />
        </TabsContent>

        <TabsContent value="weekly">
          <InstitutionWeeklyPage />
        </TabsContent>
      </Tabs>
    </AppShell>
  );
};
