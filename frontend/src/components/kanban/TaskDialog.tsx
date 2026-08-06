import { useEffect, useState } from 'react';

import type { Task } from '../../features/kanban/kanban.schema.js';
import { useCreateTask, useUpdateTask } from '../../features/kanban/useKanban.js';
import { useCourseRoster } from '../../features/teacher/useTeacher.js';
import { ApiError } from '../../lib/apiError.js';
import { toast } from '../../lib/toast.js';
import { Dialog } from '../ui/Dialog.js';
import { Button } from '../ui/Button.js';
import { Field } from '../ui/Field.js';
import { Input } from '../ui/Input.js';
import { Textarea } from '../ui/Textarea.js';
import { Select } from '../ui/Select.js';
import { Alert } from '../ui/Alert.js';

interface TaskDialogProps {
  courseId: string;
  projectId: string;
  columnId: string;
  task: Task | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const TaskDialog = ({ courseId, projectId, columnId, task, open, onOpenChange }: TaskDialogProps) => {
  const { data: roster } = useCourseRoster(courseId);
  const createTask = useCreateTask(courseId, projectId);
  const updateTask = useUpdateTask(courseId, projectId);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [assigneeId, setAssigneeId] = useState('');

  useEffect(() => {
    if (!open) return;
    setTitle(task?.title ?? '');
    setDescription(task?.description ?? '');
    setAssigneeId(task?.assigneeId ?? '');
  }, [open, task]);

  const mutation = task ? updateTask : createTask;
  const error = mutation.error;

  const onSubmit = async () => {
    if (!title.trim()) {
      toast.error('Title is required');
      return;
    }
    try {
      if (task) {
        await updateTask.mutateAsync({
          taskId: task.id,
          input: { title, description: description || null, assigneeId: assigneeId || null },
        });
        toast.success('Task updated');
      } else {
        await createTask.mutateAsync({
          columnId,
          input: { title, description: description || null, assigneeId: assigneeId || null },
        });
        toast.success('Task added');
      }
      onOpenChange(false);
    } catch {
      // error already surfaced below
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={task ? 'Edit task' : 'New task'}>
      <div className="flex flex-col gap-4">
        {error instanceof ApiError ? <Alert>{error.message}</Alert> : null}

        <Field label="Title" htmlFor="task-title">
          <Input id="task-title" value={title} onChange={(e) => setTitle(e.target.value)} />
        </Field>
        <Field label="Description" htmlFor="task-description">
          <Textarea id="task-description" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        <Field label="Assignee" htmlFor="task-assignee" hint="Optional">
          <Select
            id="task-assignee"
            value={assigneeId}
            onValueChange={setAssigneeId}
            placeholder="Unassigned"
            options={(roster ?? []).map((s) => ({ value: s.id, label: s.name }))}
          />
        </Field>

        <div className="mt-2 flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" loading={mutation.isPending} onClick={onSubmit}>
            {task ? 'Save changes' : 'Add task'}
          </Button>
        </div>
      </div>
    </Dialog>
  );
};
