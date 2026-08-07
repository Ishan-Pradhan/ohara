/**
 * buildTodayActions — pure function
 *
 * Derives a ranked, actionable list of items the student should focus on
 * today. Inputs come entirely from data already fetched by existing queries
 * (dashboard, study plan, concept inventory) — no new API calls.
 *
 * Priority order (highest first):
 *   1. OVERDUE     — assignments past due date with no submission
 *   2. DUE_SOON    — assignments due within the next 3 days, no submission
 *   3. QUIZ        — published quizzes with no attempt
 *   4. STALE_PLAN  — active study plan marked stale, prompt to regenerate
 *   5. TODAY_TASKS — today's undone tasks from the active study plan
 *   6. WEAK_CONCEPT — top needs_attention concept topics (max 2)
 *   7. PROGRESS    — positive recent grade worth surfacing (≥ 80%)
 *
 * Rules:
 * - Maximum 7 items total so the list stays scannable.
 * - No AI text. Every label is derived from real academic data.
 * - Returns [] when data is insufficient (not placed, no enrollments).
 */

import type { StudentDashboard, UpcomingItem, RecentGradeItem } from './dashboard.schema.js';
import type { StudyPlan } from './studyPlan.schema.js';
import type { ConceptInventory } from './conceptInventory.schema.js';

// ──────────────────────────────────────────────────────────────────────────────
// Action shape
// ──────────────────────────────────────────────────────────────────────────────

export type ActionKind =
  | 'overdue'
  | 'due_soon'
  | 'quiz'
  | 'stale_plan'
  | 'today_task'
  | 'weak_concept'
  | 'progress';

export interface TodayAction {
  id: string;
  kind: ActionKind;
  /** Short label shown in bold. */
  label: string;
  /** Supporting detail shown in muted text. */
  detail: string;
  /** React Router href — null for actions with no direct deep-link. */
  href: string | null;
  /** Due date ISO string — only for overdue/due_soon. */
  dueAt: string | null;
}

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_ACTIONS = 7;

const today = (): Date => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

const daysUntil = (iso: string): number => {
  const due = new Date(iso);
  due.setHours(0, 0, 0, 0);
  const diff = due.getTime() - today().getTime();
  return Math.ceil(diff / DAY_MS);
};

const assignmentLink = (courseId: string, id: string) =>
  `/student/courses/${courseId}/assignments/${id}`;

const quizLink = (courseId: string, id: string) =>
  `/student/courses/${courseId}/quizzes/${id}`;

const todayDayName = (): string => {
  return new Date().toLocaleDateString('en-US', { weekday: 'long' });
};

// ──────────────────────────────────────────────────────────────────────────────
// Main function
// ──────────────────────────────────────────────────────────────────────────────

export interface BuildTodayActionsInput {
  dashboard: StudentDashboard | undefined;
  studyPlan: StudyPlan | null | undefined;
  conceptInventory: ConceptInventory | undefined;
}

export const buildTodayActions = ({
  dashboard,
  studyPlan,
  conceptInventory,
}: BuildTodayActionsInput): TodayAction[] => {
  if (!dashboard?.placed) return [];

  const actions: TodayAction[] = [];

  // ── 1. Overdue assignments ─────────────────────────────────────────────────
  const overdueItems = dashboard.upcoming
    .filter((item): item is UpcomingItem & { type: 'assignment'; dueAt: string } =>
      item.type === 'assignment' && item.dueAt !== null && daysUntil(item.dueAt) < 0,
    )
    .sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime());

  for (const item of overdueItems.slice(0, 2)) {
    const daysAgo = Math.abs(daysUntil(item.dueAt));
    actions.push({
      id: `overdue-${item.id}`,
      kind: 'overdue',
      label: item.title,
      detail: `${item.courseTitle} · ${daysAgo === 1 ? 'Due yesterday' : `${daysAgo} days overdue`}`,
      href: assignmentLink(item.courseId, item.id),
      dueAt: item.dueAt,
    });
  }

  // ── 2. Due soon (within 3 days) ────────────────────────────────────────────
  const dueSoonItems = dashboard.upcoming
    .filter((item): item is UpcomingItem & { type: 'assignment'; dueAt: string } =>
      item.type === 'assignment' &&
      item.dueAt !== null &&
      daysUntil(item.dueAt) >= 0 &&
      daysUntil(item.dueAt) <= 3,
    )
    .sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime());

  for (const item of dueSoonItems.slice(0, 2)) {
    const days = daysUntil(item.dueAt);
    const dueLabel = days === 0 ? 'Due today' : days === 1 ? 'Due tomorrow' : `Due in ${days} days`;
    actions.push({
      id: `due-soon-${item.id}`,
      kind: 'due_soon',
      label: item.title,
      detail: `${item.courseTitle} · ${dueLabel}`,
      href: assignmentLink(item.courseId, item.id),
      dueAt: item.dueAt,
    });
  }

  // ── 3. Unattempted quizzes ─────────────────────────────────────────────────
  const quizItems = dashboard.upcoming.filter(
    (item): item is UpcomingItem & { type: 'quiz' } => item.type === 'quiz',
  );

  for (const item of quizItems.slice(0, 2)) {
    actions.push({
      id: `quiz-${item.id}`,
      kind: 'quiz',
      label: item.title,
      detail: `${item.courseTitle} · Quiz not yet attempted`,
      href: quizLink(item.courseId, item.id),
      dueAt: null,
    });
  }

  // ── 4. Stale study plan ────────────────────────────────────────────────────
  if (studyPlan?.isStale) {
    actions.push({
      id: 'stale-plan',
      kind: 'stale_plan',
      label: 'Study plan needs updating',
      detail: studyPlan.staleReason ?? 'Your plan may no longer reflect your current situation.',
      href: '/student/progress#study-plan',
      dueAt: null,
    });
  }

  // ── 5. Today's study plan tasks ────────────────────────────────────────────
  if (studyPlan && !studyPlan.isStale) {
    const dayName = todayDayName();
    const todayPlan = studyPlan.content.days.find((d) => d.day === dayName);

    if (todayPlan) {
      const pendingTasks = todayPlan.tasks.filter((t) => !t.done);
      for (const task of pendingTasks.slice(0, 2)) {
        actions.push({
          id: `today-task-${task.title.toLowerCase().replace(/\s+/g, '-')}`,
          kind: 'today_task',
          label: task.title,
          detail: `${task.courseTitle ? `${task.courseTitle} · ` : ''}${task.estimatedMinutes} min · ${task.priority} priority`,
          href: '/student/progress',
          dueAt: null,
        });
      }
    }
  }

  // ── 6. Weak concepts ──────────────────────────────────────────────────────
  if (conceptInventory) {
    const weakTopics: { topic: string; courseTitle: string }[] = [];

    for (const course of conceptInventory.courses) {
      for (const concept of course.concepts) {
        if (concept.masteryState === 'needs_attention') {
          weakTopics.push({ topic: concept.topic, courseTitle: course.courseTitle });
        }
      }
    }

    for (const { topic, courseTitle } of weakTopics.slice(0, 2)) {
      actions.push({
        id: `weak-concept-${topic.toLowerCase().replace(/\s+/g, '-')}`,
        kind: 'weak_concept',
        label: topic,
        detail: `${courseTitle} · Needs attention`,
        href: '/student/progress?tab=concepts',
        dueAt: null,
      });
    }
  }

  // ── 7. Positive recent grade (progress signal) ─────────────────────────────
  if (actions.length < MAX_ACTIONS && dashboard.recentGrades.length > 0) {
    const best = dashboard.recentGrades
      .filter((g): g is RecentGradeItem =>
        g.maxScore > 0 && (g.score / g.maxScore) * 100 >= 80,
      )
      .sort((a, b) => new Date(b.gradedAt).getTime() - new Date(a.gradedAt).getTime())[0];

    if (best) {
      const pct = Math.round((best.score / best.maxScore) * 100);
      actions.push({
        id: `progress-${best.id}`,
        kind: 'progress',
        label: `${pct}% on ${best.title}`,
        detail: `${best.courseTitle} · Great result`,
        href:
          best.type === 'assignment'
            ? assignmentLink(best.courseId, best.id)
            : quizLink(best.courseId, best.id),
        dueAt: null,
      });
    }
  }

  return actions.slice(0, MAX_ACTIONS);
};
