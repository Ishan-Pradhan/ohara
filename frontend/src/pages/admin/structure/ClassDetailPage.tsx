import { Link, useParams } from 'react-router-dom';
import { ChevronRight, Layers } from 'lucide-react';

import { useClasses, usePrograms } from '../../../features/institution/useInstitution.js';
import { AppShell } from '../../../components/layout/AppShell.js';
import { PageHeader } from '../../../components/layout/PageHeader.js';
import { Skeleton } from '../../../components/ui/Skeleton.js';
import { EmptyState } from '../../../components/ui/EmptyState.js';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../../components/ui/Tabs.js';
import { SectionsTab } from './SectionsTab.js';
import { CoursesTab } from './CoursesTab.js';

export const ClassDetailPage = () => {
  const { programId = '', classId = '' } = useParams();
  const { data: programs, isLoading: programsLoading } = usePrograms();
  const { data: classes, isLoading: classesLoading } = useClasses();

  const program = programs?.find((p) => p.id === programId);
  const cls = classes?.find((c) => c.id === classId && c.programId === programId);
  const isLoading = programsLoading || classesLoading;

  return (
    <AppShell>
      <div className="mb-1 flex items-center gap-1.5 text-sm text-muted">
        <Link to="/admin/structure" className="hover:text-fg hover:underline">
          Structure
        </Link>
        <ChevronRight className="size-3.5" aria-hidden />
        <Link to={`/admin/structure/${programId}`} className="hover:text-fg hover:underline">
          {program?.name ?? '…'}
        </Link>
        <ChevronRight className="size-3.5" aria-hidden />
        <span className="text-fg">{cls?.name ?? '…'}</span>
      </div>

      <PageHeader
        title={cls ? cls.name : 'Class'}
        description={
          cls
            ? 'Sections place students into this class for a given academic year; courses are what gets taught in it.'
            : undefined
        }
      />

      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : !program || !cls ? (
        <EmptyState
          icon={Layers}
          title="Class not found"
          description="It may have been deleted."
          action={
            <Link
              to="/admin/structure"
              className="inline-flex items-center justify-center gap-2 rounded-control bg-primary px-4 py-2.5 text-sm font-medium text-primary-fg hover:bg-primary-hover"
            >
              Back to Structure
            </Link>
          }
        />
      ) : (
        <Tabs defaultValue="sections">
          <TabsList>
            <TabsTrigger value="sections">Sections</TabsTrigger>
            <TabsTrigger value="courses">Courses</TabsTrigger>
          </TabsList>
          <TabsContent value="sections">
            <SectionsTab classId={classId} />
          </TabsContent>
          <TabsContent value="courses">
            <CoursesTab classId={classId} />
          </TabsContent>
        </Tabs>
      )}
    </AppShell>
  );
};
