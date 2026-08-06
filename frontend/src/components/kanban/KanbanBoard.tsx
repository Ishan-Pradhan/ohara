import { useState } from 'react';
import {
  DndContext,
  closestCorners,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, MoreVertical, Plus, Trash2, User as UserIcon } from 'lucide-react';

import type { Project, Task } from '../../features/kanban/kanban.schema.js';
import {
  useCreateColumn,
  useDeleteColumn,
  useDeleteTask,
  useMoveTask,
} from '../../features/kanban/useKanban.js';
import { toast } from '../../lib/toast.js';
import { cn } from '../../lib/cn.js';
import { Card } from '../ui/Card.js';
import { Button } from '../ui/Button.js';
import { Badge } from '../ui/Badge.js';
import { Input } from '../ui/Input.js';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../ui/DropdownMenu.js';
import { TaskDialog } from './TaskDialog.js';

interface KanbanBoardProps {
  courseId: string;
  project: Project;
  currentUserId: string;
  isTeacher: boolean;
}

const TaskCard = ({ task, isTeacher, currentUserId, courseId, projectId }: {
  task: Task;
  isTeacher: boolean;
  currentUserId: string;
  courseId: string;
  projectId: string;
}) => {
  const canDrag = isTeacher || task.assigneeId === currentUserId;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    disabled: !canDrag,
  });
  const deleteTask = useDeleteTask(courseId, projectId);
  const [editing, setEditing] = useState(false);

  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };

  return (
    <>
      <div
        ref={setNodeRef}
        style={style}
        className="flex flex-col gap-2 rounded-control border border-border bg-surface p-3 shadow-sm shadow-black/[0.02]"
      >
        <div className="flex items-start justify-between gap-2">
          <button
            type="button"
            className={cn('mt-0.5 shrink-0 text-subtle', canDrag ? 'cursor-grab touch-none' : 'cursor-not-allowed opacity-40')}
            {...(canDrag ? { ...attributes, ...listeners } : {})}
            aria-label="Drag task"
          >
            <GripVertical className="size-4" aria-hidden />
          </button>
          <p className="flex-1 text-sm font-medium text-fg">{task.title}</p>
          {isTeacher ? (
            <DropdownMenu>
              <DropdownMenuTrigger className="shrink-0 rounded-control p-1 text-subtle hover:bg-surface-hover hover:text-fg">
                <MoreVertical className="size-3.5" aria-hidden />
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onSelect={() => setEditing(true)}>Edit</DropdownMenuItem>
                <DropdownMenuItem destructive onSelect={() => deleteTask.mutate(task.id)}>
                  <Trash2 className="size-4" aria-hidden />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>
        {task.description ? <p className="text-xs text-muted">{task.description}</p> : null}
        {task.assigneeName ? (
          <Badge variant="neutral" className="w-fit gap-1">
            <UserIcon className="size-3" aria-hidden />
            {task.assigneeName}
          </Badge>
        ) : null}
      </div>
      {isTeacher ? (
        <TaskDialog
          courseId={courseId}
          projectId={projectId}
          columnId={task.columnId}
          task={task}
          open={editing}
          onOpenChange={setEditing}
        />
      ) : null}
    </>
  );
};

const Column = ({ column, courseId, projectId, isTeacher, currentUserId }: {
  column: Project['columns'][number];
  courseId: string;
  projectId: string;
  isTeacher: boolean;
  currentUserId: string;
}) => {
  const { setNodeRef } = useDroppable({ id: column.id });
  const deleteColumn = useDeleteColumn(courseId, projectId);
  const [addingTask, setAddingTask] = useState(false);

  return (
    <div className="flex w-72 shrink-0 flex-col gap-3">
      <div className="flex items-center justify-between px-1">
        <h3 className="text-sm font-semibold text-fg">
          {column.name} <span className="text-xs font-normal text-subtle">{column.tasks.length}</span>
        </h3>
        {isTeacher ? (
          <DropdownMenu>
            <DropdownMenuTrigger className="rounded-control p-1 text-subtle hover:bg-surface-hover hover:text-fg">
              <MoreVertical className="size-3.5" aria-hidden />
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem
                destructive
                onSelect={() => deleteColumn.mutate(column.id)}
                disabled={column.tasks.length > 0}
              >
                <Trash2 className="size-4" aria-hidden />
                Delete column
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>

      <SortableContext items={column.tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
        <div ref={setNodeRef} className="flex min-h-16 flex-col gap-2 rounded-card bg-surface-hover/50 p-2">
          {column.tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              isTeacher={isTeacher}
              currentUserId={currentUserId}
              courseId={courseId}
              projectId={projectId}
            />
          ))}
        </div>
      </SortableContext>

      {isTeacher ? (
        <Button variant="ghost" size="sm" className="justify-start" onClick={() => setAddingTask(true)}>
          <Plus className="size-4" aria-hidden />
          Add task
        </Button>
      ) : null}

      {isTeacher ? (
        <TaskDialog
          courseId={courseId}
          projectId={projectId}
          columnId={column.id}
          task={null}
          open={addingTask}
          onOpenChange={setAddingTask}
        />
      ) : null}
    </div>
  );
};

export const KanbanBoard = ({ courseId, project, currentUserId, isTeacher }: KanbanBoardProps) => {
  const moveTask = useMoveTask(courseId, project.id);
  const createColumn = useCreateColumn(courseId, project.id);
  const [addingColumn, setAddingColumn] = useState(false);
  const [newColumnName, setNewColumnName] = useState('');

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const findTask = (taskId: string): Task | undefined =>
    project.columns.flatMap((c) => c.tasks).find((t) => t.id === taskId);

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;
    const activeTask = findTask(String(active.id));
    if (!activeTask) return;

    const overId = String(over.id);
    const overColumn = project.columns.find((c) => c.id === overId);
    const overTask = !overColumn ? findTask(overId) : null;
    const targetColumn = overColumn ?? project.columns.find((c) => c.id === overTask?.columnId);
    if (!targetColumn) return;

    const targetIndex = overTask
      ? targetColumn.tasks.findIndex((t) => t.id === overTask.id)
      : targetColumn.tasks.length;

    if (targetColumn.id === activeTask.columnId && targetIndex === activeTask.orderIndex) return;

    moveTask.mutate({ taskId: activeTask.id, input: { columnId: targetColumn.id, orderIndex: targetIndex } });
  };

  const onAddColumn = async () => {
    if (!newColumnName.trim()) return;
    try {
      await createColumn.mutateAsync(newColumnName.trim());
      setNewColumnName('');
      setAddingColumn(false);
    } catch {
      toast.error('Could not add the column');
    }
  };

  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={onDragEnd}>
        {project.columns.map((column) => (
          <Column
            key={column.id}
            column={column}
            courseId={courseId}
            projectId={project.id}
            isTeacher={isTeacher}
            currentUserId={currentUserId}
          />
        ))}
      </DndContext>

      {isTeacher ? (
        <div className="w-64 shrink-0">
          {addingColumn ? (
            <Card padding="sm" className="flex flex-col gap-2">
              <Input
                placeholder="Column name"
                value={newColumnName}
                onChange={(e) => setNewColumnName(e.target.value)}
                autoFocus
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={onAddColumn} loading={createColumn.isPending}>
                  Add
                </Button>
                <Button size="sm" variant="secondary" onClick={() => setAddingColumn(false)}>
                  Cancel
                </Button>
              </div>
            </Card>
          ) : (
            <Button variant="ghost" size="sm" onClick={() => setAddingColumn(true)}>
              <Plus className="size-4" aria-hidden />
              Add column
            </Button>
          )}
        </div>
      ) : null}
    </div>
  );
};
