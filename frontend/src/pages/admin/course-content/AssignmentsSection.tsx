import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ClipboardList, Pencil, Plus, Trash2 } from 'lucide-react';

import {
  useAssignments,
  useDeleteAssignment,
} from '../../../features/assignments/useAssignments.js';
import type { Assignment } from '../../../features/assignments/assignments.schema.js';
import { toast } from '../../../lib/toast.js';
import { Button } from '../../../components/ui/Button.js';
import { Badge } from '../../../components/ui/Badge.js';
import { Card } from '../../../components/ui/Card.js';
import { Skeleton } from '../../../components/ui/Skeleton.js';
import { EmptyState } from '../../../components/ui/EmptyState.js';
import { ConfirmDialog } from '../../../components/ui/Dialog.js';
import { AssignmentDialog } from './AssignmentDialog.js';

interface AssignmentsSectionProps {
  courseId: string;
}

export const AssignmentsSection = ({ courseId }: AssignmentsSectionProps) => {
  const { data: assignments, isLoading } = useAssignments(courseId);
  const deleteAssignment = useDeleteAssignment(courseId);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Assignment | null>(null);
  const [deleting, setDeleting] = useState<Assignment | null>(null);

  const openCreate = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  const openEdit = (assignment: Assignment) => {
    setEditing(assignment);
    setDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    await deleteAssignment.mutateAsync(deleting.id);
    toast.success(`${deleting.title} deleted`);
    setDeleting(null);
  };

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-base font-semibold text-fg">Assignments</h2>
        <Button size="sm" onClick={openCreate}>
          <Plus className="size-4" aria-hidden />
          New assignment
        </Button>
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : !assignments || assignments.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="No assignments yet"
          description="Create an assignment with a rubric — students can submit text and/or a file against it."
        />
      ) : (
        <div className="flex flex-col gap-2">
          {assignments.map((assignment) => {
            const totalPoints = assignment.rubric.reduce((sum, c) => sum + c.maxPoints, 0);
            return (
              <Card key={assignment.id} padding="sm" className="flex items-center justify-between gap-3">
                <Link to={`/admin/courses/${courseId}/assignments/${assignment.id}`} className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-fg hover:underline">{assignment.title}</p>
                  <p className="truncate text-xs text-muted">
                    Due {new Date(assignment.dueAt).toLocaleString()} · {totalPoints} points
                  </p>
                </Link>
                <div className="flex shrink-0 items-center gap-2">
                  <Badge>{assignment.rubric.length} criteri{assignment.rubric.length === 1 ? 'on' : 'a'}</Badge>
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label={`Edit ${assignment.title}`}
                    onClick={() => openEdit(assignment)}
                  >
                    <Pencil className="size-4" aria-hidden />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label={`Delete ${assignment.title}`}
                    onClick={() => setDeleting(assignment)}
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <AssignmentDialog
        courseId={courseId}
        assignment={editing}
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setEditing(null);
        }}
      />

      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Delete this assignment?"
        description={`${deleting?.title} and all its submissions/grades will be permanently removed.`}
        confirmLabel="Delete"
        destructive
        loading={deleteAssignment.isPending}
        onConfirm={confirmDelete}
      />
    </div>
  );
};
