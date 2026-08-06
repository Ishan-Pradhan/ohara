import { useState } from 'react';
import { ChevronLeft, LayoutGrid, Plus, Trash2 } from 'lucide-react';

import { useCurrentUser } from '../../../features/auth/useAuth.js';
import { useProjects, useProject, useCreateProject, useDeleteProject } from '../../../features/kanban/useKanban.js';
import { KanbanBoard } from '../../../components/kanban/KanbanBoard.js';
import { toast } from '../../../lib/toast.js';
import { Card } from '../../../components/ui/Card.js';
import { Button } from '../../../components/ui/Button.js';
import { Input } from '../../../components/ui/Input.js';
import { Skeleton } from '../../../components/ui/Skeleton.js';
import { EmptyState } from '../../../components/ui/EmptyState.js';
import { Dialog, ConfirmDialog } from '../../../components/ui/Dialog.js';

interface ProjectsSectionProps {
  courseId: string;
}

export const ProjectsSection = ({ courseId }: ProjectsSectionProps) => {
  const { data: user } = useCurrentUser();
  const { data: projects, isLoading } = useProjects(courseId);
  const createProject = useCreateProject(courseId);
  const deleteProject = useDeleteProject(courseId);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [name, setName] = useState('');

  const { data: project, isLoading: projectLoading } = useProject(courseId, selectedId ?? '');

  const onCreate = async () => {
    if (!name.trim()) return;
    try {
      const created = await createProject.mutateAsync(name.trim());
      toast.success('Project created');
      setName('');
      setDialogOpen(false);
      setSelectedId(created.id);
    } catch {
      toast.error('Could not create the project');
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    await deleteProject.mutateAsync(deleting);
    toast.success('Project deleted');
    if (selectedId === deleting) setSelectedId(null);
    setDeleting(null);
  };

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
            <KanbanBoard courseId={courseId} project={project} currentUserId={user?.id ?? ''} isTeacher />
          </>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-fg">Projects</h2>
        <Button size="sm" onClick={() => setDialogOpen(true)}>
          <Plus className="size-4" aria-hidden />
          New project
        </Button>
      </div>

      {!projects || projects.length === 0 ? (
        <EmptyState
          icon={LayoutGrid}
          title="No projects yet"
          description="Create a Kanban board to organize course tasks and assign them to students."
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => (
            <Card key={p.id} padding="sm" className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setSelectedId(p.id)}
                className="min-w-0 flex-1 truncate text-left text-sm font-medium text-fg hover:text-primary"
              >
                {p.name}
              </button>
              <Button variant="ghost" size="sm" aria-label="Delete project" onClick={() => setDeleting(p.id)}>
                <Trash2 className="size-4 text-danger" aria-hidden />
              </Button>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen} title="New project">
        <div className="flex flex-col gap-4">
          <Input placeholder="e.g. Final Project" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button loading={createProject.isPending} onClick={onCreate}>
              Create
            </Button>
          </div>
        </div>
      </Dialog>

      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Delete this project?"
        description="The board and all its tasks will be permanently removed."
        confirmLabel="Delete"
        destructive
        loading={deleteProject.isPending}
        onConfirm={confirmDelete}
      />
    </div>
  );
};
