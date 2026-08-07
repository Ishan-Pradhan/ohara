import { useState } from 'react';
import {
  AlertCircle,
  BookOpen,
  CalendarDays,
  CheckCircle,
  Clock,
  Loader2,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
  TriangleAlert,
  X,
} from 'lucide-react';

import {
  useStudyPlan,
  useGenerateStudyPlan,
  useToggleTask,
  useDeleteTask,
  useAddTask,
} from '../../features/dashboard/useStudyPlan.js';
import type { StudyPlanDay, StudyPlanTask } from '../../features/dashboard/studyPlan.schema.js';
import { Card } from '../../components/ui/Card.js';
import { Badge } from '../../components/ui/Badge.js';
import { Button } from '../../components/ui/Button.js';
import { Checkbox } from '../../components/ui/Checkbox.js';
import { Input } from '../../components/ui/Input.js';
import { Skeleton } from '../../components/ui/Skeleton.js';
import { EmptyState } from '../../components/ui/EmptyState.js';
import { cn } from '../../lib/cn.js';

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────

const priorityVariant = (
  priority: StudyPlanTask['priority'],
): 'danger' | 'warning' | 'neutral' => {
  if (priority === 'high') return 'danger';
  if (priority === 'medium') return 'warning';
  return 'neutral';
};

const taskTypeIcon = (type: StudyPlanTask['type']) => {
  switch (type) {
    case 'assignment':
    case 'quiz':
      return <CheckCircle className="size-3.5" aria-hidden />;
    case 'review':
    case 'concept':
      return <BookOpen className="size-3.5" aria-hidden />;
    default:
      return <Sparkles className="size-3.5" aria-hidden />;
  }
};

// ──────────────────────────────────────────────────────────────────────────────
// Add task form (inline, per day)
// ──────────────────────────────────────────────────────────────────────────────

const PRIORITIES: Array<StudyPlanTask['priority']> = ['high', 'medium', 'low'];

const AddTaskForm = ({
  dayIndex,
  onClose,
}: {
  dayIndex: number;
  onClose: () => void;
}) => {
  const { mutate: add, isPending } = useAddTask();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [minutes, setMinutes] = useState('30');
  const [priority, setPriority] = useState<StudyPlanTask['priority']>('medium');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    add(
      {
        dayIndex,
        task: {
          title: title.trim(),
          description: description.trim() || title.trim(),
          estimatedMinutes: Math.max(5, Math.min(240, Number(minutes) || 30)),
          priority,
        },
      },
      { onSuccess: onClose },
    );
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-2 rounded-control border border-primary/30 bg-primary-soft p-3"
    >
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-semibold text-primary">Add task</span>
        <button
          type="button"
          onClick={onClose}
          className="rounded p-0.5 text-muted hover:text-fg"
          aria-label="Cancel"
        >
          <X className="size-3.5" />
        </button>
      </div>

      <div className="flex flex-col gap-2">
        <Input
          placeholder="Task title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          autoFocus
          required
          className="text-sm"
        />
        <Input
          placeholder="Description (optional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="text-sm"
        />
        <div className="flex gap-2">
          <Input
            type="number"
            min={5}
            max={240}
            placeholder="Minutes"
            value={minutes}
            onChange={(e) => setMinutes(e.target.value)}
            className="w-24 text-sm"
          />
          <div className="flex gap-1">
            {PRIORITIES.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPriority(p)}
                className={cn(
                  'rounded-pill px-2.5 py-1 text-xs font-medium transition-colors',
                  priority === p
                    ? p === 'high'
                      ? 'bg-danger text-white'
                      : p === 'medium'
                        ? 'bg-warning text-white'
                        : 'bg-border text-fg'
                    : 'bg-surface-hover text-muted hover:text-fg',
                )}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
        <Button type="submit" size="sm" loading={isPending} disabled={!title.trim()}>
          Add
        </Button>
      </div>
    </form>
  );
};

// ──────────────────────────────────────────────────────────────────────────────
// Task row with checkbox + delete
// ──────────────────────────────────────────────────────────────────────────────

const TaskRow = ({
  task,
  dayIndex,
  taskIndex,
}: {
  task: StudyPlanTask;
  dayIndex: number;
  taskIndex: number;
}) => {
  const { mutate: toggle, isPending: toggling } = useToggleTask();
  const { mutate: remove, isPending: deleting } = useDeleteTask();

  return (
    <div
      className={cn(
        'group flex items-start gap-3 rounded-control px-3 py-2.5 transition-colors',
        task.done ? 'bg-surface opacity-60' : 'bg-surface-hover',
      )}
    >
      <Checkbox
        checked={task.done ?? false}
        onCheckedChange={(checked) =>
          toggle({ dayIndex, taskIndex, done: checked === true })
        }
        disabled={toggling}
      />

      <div
        className={cn(
          'flex min-w-0 flex-1 items-center gap-2',
          task.done ? 'line-through' : '',
        )}
      >
        <div
          className={cn(
            'flex size-5 shrink-0 items-center justify-center rounded-full',
            task.priority === 'high'
              ? 'bg-danger/10 text-danger'
              : task.priority === 'medium'
                ? 'bg-warning/10 text-warning'
                : 'bg-surface text-subtle',
          )}
        >
          {taskTypeIcon(task.type)}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-fg">{task.title}</p>
          <p className="mt-0.5 text-xs text-muted">{task.description}</p>
          {task.courseTitle ? (
            <p className="mt-0.5 text-xs text-subtle">{task.courseTitle}</p>
          ) : null}
        </div>
      </div>

      <div className="flex shrink-0 flex-col items-end gap-1">
        <Badge variant={priorityVariant(task.priority)} className="capitalize">
          {task.priority}
        </Badge>
        <span className="flex items-center gap-1 text-xs text-muted">
          <Clock className="size-3" aria-hidden />
          {task.estimatedMinutes}m
        </span>
      </div>

      <button
        onClick={() => remove({ dayIndex, taskIndex })}
        disabled={deleting}
        className="mt-0.5 shrink-0 rounded p-0.5 text-subtle opacity-0 transition-opacity hover:text-danger group-hover:opacity-100 focus-visible:opacity-100"
        aria-label="Remove task"
      >
        {deleting ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <Trash2 className="size-3.5" />
        )}
      </button>
    </div>
  );
};

// ──────────────────────────────────────────────────────────────────────────────
// Day section
// ──────────────────────────────────────────────────────────────────────────────

const DaySection = ({ day, dayIndex }: { day: StudyPlanDay; dayIndex: number }) => {
  const [showForm, setShowForm] = useState(false);
  const date = new Date(day.date + 'T00:00:00');
  const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const totalMinutes = day.tasks.reduce((sum, t) => sum + t.estimatedMinutes, 0);
  const doneCount = day.tasks.filter((t) => t.done).length;

  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <CalendarDays className="size-4 text-primary" aria-hidden />
        <span className="text-sm font-semibold text-fg">{day.day}</span>
        <span className="text-xs text-muted">{dateStr}</span>
        {day.tasks.length > 0 ? (
          <span className="text-xs text-subtle">
            {doneCount}/{day.tasks.length} done · {totalMinutes}m
          </span>
        ) : null}
        <button
          onClick={() => setShowForm((v) => !v)}
          className="ml-auto flex items-center gap-1 rounded-control px-2 py-0.5 text-xs text-muted hover:bg-surface-hover hover:text-fg"
          aria-label={`Add task to ${day.day}`}
        >
          <Plus className="size-3" aria-hidden />
          Add
        </button>
      </div>

      <div className="flex flex-col gap-1.5">
        {day.tasks.map((task, i) => (
          <TaskRow key={`${day.day}-${i}`} task={task} dayIndex={dayIndex} taskIndex={i} />
        ))}
      </div>

      {showForm ? (
        <AddTaskForm dayIndex={dayIndex} onClose={() => setShowForm(false)} />
      ) : null}
    </div>
  );
};

// ──────────────────────────────────────────────────────────────────────────────
// Main card
// ──────────────────────────────────────────────────────────────────────────────

export const StudyPlanCard = () => {
  const { data: plan, isLoading, isError } = useStudyPlan();
  const { mutate: generate, isPending } = useGenerateStudyPlan();

  if (isLoading) {
    return (
      <Card padding="sm">
        <Skeleton className="mb-4 h-7 w-48" />
        <div className="flex flex-col gap-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      </Card>
    );
  }

  if (isError) {
    return (
      <Card padding="sm">
        <EmptyState
          icon={AlertCircle}
          title="Study plan unavailable"
          description="Could not load your study plan right now. Try generating a new one."
          action={
            <Button size="sm" variant="secondary" loading={isPending} onClick={() => generate()}>
              <RefreshCw className="size-4" aria-hidden />
              Generate plan
            </Button>
          }
        />
      </Card>
    );
  }

  return (
    <Card padding="sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Sparkles className="size-4.5 text-primary" aria-hidden />
          <h2 className="text-sm font-semibold text-fg">AI Study Plan</h2>
          {plan ? (
            <Badge variant="neutral" className="text-xs">
              Week of{' '}
              {new Date(plan.weekStart + 'T00:00:00').toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
              })}
            </Badge>
          ) : null}
        </div>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => generate()}
          disabled={isPending}
          aria-label={plan ? 'Regenerate study plan' : 'Generate study plan'}
        >
          {isPending ? (
            <Loader2 className="size-3.5 animate-spin" aria-hidden />
          ) : (
            <RefreshCw className="size-3.5" aria-hidden />
          )}
          {plan ? 'Regenerate' : 'Generate plan'}
        </Button>
      </div>

      {!plan ? (
        <EmptyState
          icon={Sparkles}
          title="No study plan yet"
          description="Generate a personalised weekly study plan based on your upcoming assessments and weak areas."
        />
      ) : (
        <>
          {plan.isStale ? (
            <div className="mb-4 flex items-start gap-3 rounded-control border border-warning/40 bg-warning-soft px-3 py-2.5">
              <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-fg">Your plan may be outdated</p>
                {plan.staleReason ? (
                  <p className="mt-0.5 text-xs text-muted">{plan.staleReason}</p>
                ) : null}
              </div>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => generate()}
                disabled={isPending}
                className="shrink-0"
              >
                {isPending ? (
                  <Loader2 className="size-3.5 animate-spin" aria-hidden />
                ) : (
                  <RefreshCw className="size-3.5" aria-hidden />
                )}
                Regenerate
              </Button>
            </div>
          ) : null}

          {plan.content.summary ? (
            <p className="mb-4 rounded-control bg-primary-soft px-3 py-2 text-sm text-primary">
              {plan.content.summary}
            </p>
          ) : null}

          <div className="mb-3 flex flex-wrap gap-3 text-xs text-muted">
            <span>{plan.content.evidence.upcomingAssessments} upcoming assessments</span>
            <span>{plan.content.evidence.weakConcepts} weak concepts</span>
            {plan.content.evidence.missingSubmissions > 0 ? (
              <span className="text-danger">
                {plan.content.evidence.missingSubmissions} missing submissions
              </span>
            ) : null}
          </div>

          <div className="flex flex-col gap-5">
            {plan.content.days.map((day, i) => (
              <DaySection key={day.day} day={day} dayIndex={i} />
            ))}
          </div>
        </>
      )}
    </Card>
  );
};
