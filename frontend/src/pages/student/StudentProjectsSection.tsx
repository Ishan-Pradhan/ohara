import { useState } from 'react';
import { ChevronLeft, LayoutGrid } from 'lucide-react';

import { useCurrentUser } from '../../features/auth/useAuth.js';
import { useProjects, useProject } from '../../features/kanban/useKanban.js';
import { KanbanBoard } from '../../components/kanban/KanbanBoard.js';
import { Card } from '../../components/ui/Card.js';
import { Button } from '../../components/ui/Button.js';
import { Skeleton } from '../../components/ui/Skeleton.js';
import { EmptyState } from '../../components/ui/EmptyState.js';

interface StudentProjectsSectionProps {
  courseId: string;
}

export const StudentProjectsSection = ({ courseId }: StudentProjectsSectionProps) => {
  const { data: user } = useCurrentUser();
  const { data: projects, isLoading } = useProjects(courseId);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { data: project, isLoading: projectLoading } = useProject(courseId, selectedId ?? '');

  if (isLoading) {
    return <Skeleton className="h-32 w-full" />;
  }

  if (selectedId) {
    return (
      <div className="flex flex-col gap-4">
        <Button variant="ghost" size="sm" className="w-fit" onClick={() => setSelectedId(null)}>
          <ChevronLeft className="size-4" aria-hidden />
          All projects
        </Button>
        {projectLoading || !project ? (
          <Skeleton className="h-64 w-full" />
        ) : (
          <>
            <h2 className="text-base font-semibold text-fg">{project.name}</h2>
            <p className="text-xs text-muted">Drag your own tasks between columns to update their status.</p>
            <KanbanBoard courseId={courseId} project={project} currentUserId={user?.id ?? ''} isTeacher={false} />
          </>
        )}
      </div>
    );
  }

  if (!projects || projects.length === 0) {
    return (
      <EmptyState
        icon={LayoutGrid}
        title="No projects yet"
        description="Your teacher hasn't created a project board for this course."
      />
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {projects.map((p) => (
        <Card key={p.id} padding="sm">
          <button
            type="button"
            onClick={() => setSelectedId(p.id)}
            className="w-full truncate text-left text-sm font-medium text-fg hover:text-primary"
          >
            {p.name}
          </button>
        </Card>
      ))}
    </div>
  );
};
