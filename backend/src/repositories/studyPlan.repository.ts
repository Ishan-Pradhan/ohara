import { StudyPlan } from '../models/studyPlan.model.js';
import type { StudyPlanContent, StudyPlanTask } from '../types/studyPlan.types.js';

/** Returns the ISO date string (YYYY-MM-DD) for the Monday of the current week. */
const currentWeekMonday = (): string => {
  const today = new Date();
  const dayOfWeek = today.getDay(); // 0=Sunday
  const daysToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(today);
  monday.setDate(today.getDate() + daysToMonday);
  return monday.toISOString().split('T')[0]!;
};

export const studyPlanRepository = {
  /** Fetch the student's current active study plan, or null if none. */
  findActive: async (studentId: string): Promise<StudyPlan | null> =>
    StudyPlan.findOne({
      where: { studentId, status: 'active' },
      order: [['generatedAt', 'DESC']],
    }),

  /** Supersede all existing active plans for the student, then create a fresh one. */
  createAndSupersedePrevious: async (
    studentId: string,
    weekStart: string,
    content: StudyPlanContent,
  ): Promise<StudyPlan> => {
    await StudyPlan.update(
      { status: 'superseded' },
      { where: { studentId, status: 'active' } },
    );

    return StudyPlan.create({
      studentId,
      weekStart,
      content,
      status: 'active',
      isStale: false,
      staleReason: null,
      generatedAt: new Date(),
    });
  },

  /** Persist a mutated content blob back to the active plan. */
  updateContent: async (plan: StudyPlan, content: StudyPlanContent): Promise<StudyPlan> => {
    plan.content = content;
    plan.changed('content', true); // Sequelize JSONB change detection
    return plan.save();
  },

  // ── Staleness ──────────────────────────────────────────────────────────────

  /** True if the plan's weekStart is the current calendar week. */
  isCurrentWeekPlan: (plan: StudyPlan): boolean =>
    plan.weekStart === currentWeekMonday(),

  /** Mark the plan as stale with a human-readable reason. No-op if already stale. */
  markStale: async (plan: StudyPlan, reason: string): Promise<void> => {
    if (plan.isStale) return;
    await StudyPlan.update(
      { isStale: true, staleReason: reason },
      { where: { id: plan.id } },
    );
  },

  /**
   * If the student has an active plan for the current week, mark it stale.
   * Called as a fire-and-forget side effect from academic event controllers —
   * never throws, never blocks the response.
   */
  markPlanStaleIfCurrentWeek: async (studentId: string, reason: string): Promise<void> => {
    try {
      const plan = await StudyPlan.findOne({
        where: { studentId, status: 'active' },
      });
      if (!plan) return;
      if (!studyPlanRepository.isCurrentWeekPlan(plan)) return;
      await studyPlanRepository.markStale(plan, reason);
    } catch {
      // Never let staleness marking break the calling request
    }
  },

  // ── Task mutations ─────────────────────────────────────────────────────────

  /** Toggle the done flag on a single task. Returns null if indices are out of range. */
  toggleTaskDone: async (
    plan: StudyPlan,
    dayIndex: number,
    taskIndex: number,
    done: boolean,
  ): Promise<StudyPlan | null> => {
    const content: StudyPlanContent = JSON.parse(JSON.stringify(plan.content));
    const day = content.days[dayIndex];
    if (!day) return null;
    const task = day.tasks[taskIndex];
    if (!task) return null;
    task.done = done;
    return studyPlanRepository.updateContent(plan, content);
  },

  /** Remove a task at the given position. Returns null if indices are out of range. */
  deleteTask: async (
    plan: StudyPlan,
    dayIndex: number,
    taskIndex: number,
  ): Promise<StudyPlan | null> => {
    const content: StudyPlanContent = JSON.parse(JSON.stringify(plan.content));
    const day = content.days[dayIndex];
    if (!day) return null;
    if (taskIndex < 0 || taskIndex >= day.tasks.length) return null;
    day.tasks.splice(taskIndex, 1);
    return studyPlanRepository.updateContent(plan, content);
  },

  /** Append a custom task to the specified day. Returns null if dayIndex is out of range. */
  addTask: async (
    plan: StudyPlan,
    dayIndex: number,
    task: StudyPlanTask,
  ): Promise<StudyPlan | null> => {
    const content: StudyPlanContent = JSON.parse(JSON.stringify(plan.content));
    const day = content.days[dayIndex];
    if (!day) return null;
    day.tasks.push(task);
    return studyPlanRepository.updateContent(plan, content);
  },
};
