/**
 * TodayIntelligencePanel — Slice 9: Student Dashboard Intelligence
 *
 * Answers "What should I do today?" by calling buildTodayActions (a pure
 * function) and rendering the resulting ranked action list. All data comes
 * from hooks that are already cached — no new API calls.
 *
 * Design rules:
 * - No AI text. Every label is derived from real academic data.
 * - Maximum 7 items so the list stays scannable.
 * - Each action kind gets a distinct icon + colour so students can skim fast.
 * - Loading / empty states are first-class, not afterthoughts.
 */

import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  BookOpen,
  CalendarCheck,
  CheckCircle2,
  ChevronRight,
  Clock,
  Lightbulb,
  Sparkles,
  TriangleAlert,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { useStudentDashboard } from '../../features/dashboard/useDashboard.js';
import { useStudyPlan } from '../../features/dashboard/useStudyPlan.js';
import { useConceptInventory } from '../../features/dashboard/useConceptInventory.js';
import {
  buildTodayActions,
  type TodayAction,
  type ActionKind,
} from '../../features/dashboard/buildTodayActions.js';

import { Card } from '../../components/ui/Card.js';
import { Skeleton } from '../../components/ui/Skeleton.js';
import { cn } from '../../lib/cn.js';

// ──────────────────────────────────────────────────────────────────────────────
// Action-kind configuration
// ──────────────────────────────────────────────────────────────────────────────

interface KindConfig {
  icon: LucideIcon;
  /** Tailwind token classes for the icon container background */
  iconBg: string;
  /** Tailwind token classes for the icon itself */
  iconColor: string;
  /** Optional badge label shown on the right */
  badge?: string;
  /** Tailwind token classes for the badge */
  badgeCls?: string;
}

const KIND_CONFIG: Record<ActionKind, KindConfig> = {
  overdue: {
    icon: AlertTriangle,
    iconBg: 'bg-danger-soft',
    iconColor: 'text-danger',
    badge: 'Overdue',
    badgeCls: 'bg-danger-soft text-danger border border-danger/25',
  },
  due_soon: {
    icon: Clock,
    iconBg: 'bg-warning-soft',
    iconColor: 'text-accent-fg',
    badge: 'Due soon',
    badgeCls: 'bg-warning-soft text-accent-fg border border-warning/30',
  },
  quiz: {
    icon: CalendarCheck,
    iconBg: 'bg-primary-soft',
    iconColor: 'text-primary',
    badge: 'Quiz',
    badgeCls: 'bg-primary-soft text-primary border border-primary/20',
  },
  stale_plan: {
    icon: TriangleAlert,
    iconBg: 'bg-warning-soft',
    iconColor: 'text-accent-fg',
    badge: 'Update plan',
    badgeCls: 'bg-warning-soft text-accent-fg border border-warning/30',
  },
  today_task: {
    icon: CheckCircle2,
    iconBg: 'bg-success-soft',
    iconColor: 'text-success',
  },
  weak_concept: {
    icon: Lightbulb,
    iconBg: 'bg-accent-soft',
    iconColor: 'text-accent-fg',
    badge: 'Review',
    badgeCls: 'bg-accent-soft text-accent-fg border border-accent/30',
  },
  progress: {
    icon: Sparkles,
    iconBg: 'bg-success-soft',
    iconColor: 'text-success',
    badge: 'Nice work',
    badgeCls: 'bg-success-soft text-success border border-success/25',
  },
};

// ──────────────────────────────────────────────────────────────────────────────
// Action row
// ──────────────────────────────────────────────────────────────────────────────

const ActionRow = ({ action }: { action: TodayAction }) => {
  const config = KIND_CONFIG[action.kind];
  const Icon = config.icon;

  const inner = (
    <div className="flex items-center gap-3 rounded-control px-3 py-2.5 transition-colors hover:bg-surface-hover">
      {/* Icon */}
      <div
        className={cn(
          'flex size-8 shrink-0 items-center justify-center rounded-full',
          config.iconBg,
        )}
      >
        <Icon className={cn('size-4', config.iconColor)} aria-hidden />
      </div>

      {/* Text */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-fg">{action.label}</p>
        <p className="truncate text-xs text-muted">{action.detail}</p>
      </div>

      {/* Badge or chevron */}
      {config.badge ? (
        <span
          className={cn(
            'shrink-0 rounded-pill px-2.5 py-0.5 text-xs font-medium',
            config.badgeCls,
          )}
        >
          {config.badge}
        </span>
      ) : action.href ? (
        <ChevronRight className="size-4 shrink-0 text-subtle" aria-hidden />
      ) : null}
    </div>
  );

  if (action.href) {
    return (
      <Link to={action.href} className="block">
        {inner}
      </Link>
    );
  }

  return inner;
};

// ──────────────────────────────────────────────────────────────────────────────
// Skeleton loader
// ──────────────────────────────────────────────────────────────────────────────

const PanelSkeleton = () => (
  <Card padding="sm">
    <div className="mb-3 flex items-center gap-2 px-1">
      <Skeleton className="size-4 rounded-full" />
      <Skeleton className="h-4 w-32" />
    </div>
    <div className="flex flex-col gap-1">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="flex items-center gap-3 rounded-control px-3 py-2.5">
          <Skeleton className="size-8 rounded-full" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3.5 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
          <Skeleton className="h-5 w-16 rounded-pill" />
        </div>
      ))}
    </div>
  </Card>
);

// ──────────────────────────────────────────────────────────────────────────────
// Main export
// ──────────────────────────────────────────────────────────────────────────────

export const TodayIntelligencePanel = () => {
  const { data: dashboard, isLoading: dashLoading, isError: dashError } = useStudentDashboard(true);
  // studyPlan and conceptInventory errors are treated as non-fatal: the panel
  // still renders using whatever data is available, same as the backend's
  // graceful-degradation principle. Only a dashboard failure is fatal here.
  const { data: studyPlan, isLoading: planLoading } = useStudyPlan();
  const { data: conceptInventory, isLoading: conceptsLoading } = useConceptInventory();

  const isLoading = dashLoading || planLoading || conceptsLoading;

  if (isLoading) {
    return <PanelSkeleton />;
  }

  // Dashboard request failed — surface an explicit error rather than nothing
  if (dashError) {
    return (
      <Card padding="sm">
        <div className="flex items-center gap-3 px-1 py-4 text-center">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-danger-soft">
            <AlertTriangle className="size-4 text-danger" aria-hidden />
          </div>
          <div className="min-w-0 text-left">
            <p className="text-sm font-medium text-fg">Today's actions unavailable</p>
            <p className="text-xs text-muted">Could not load your dashboard data right now.</p>
          </div>
        </div>
      </Card>
    );
  }

  // Not placed yet — no intelligence to surface
  if (!dashboard?.placed) {
    return null;
  }

  const actions = buildTodayActions({ dashboard, studyPlan, conceptInventory });

  // Nothing to surface — all caught up
  if (actions.length === 0) {
    return (
      <Card padding="sm">
        <div className="flex items-center gap-2 px-1 pb-3">
          <Sparkles className="size-4 text-primary" aria-hidden />
          <h2 className="text-sm font-semibold text-fg">Today</h2>
        </div>
        <div className="flex flex-col items-center gap-2 py-8 text-center">
          <div className="flex size-10 items-center justify-center rounded-full bg-success-soft">
            <CheckCircle2 className="size-5 text-success" aria-hidden />
          </div>
          <p className="text-sm font-medium text-fg">All caught up</p>
          <p className="max-w-xs text-xs text-muted">
            No pending assignments, quizzes, or weak areas to surface right now.
          </p>
        </div>
      </Card>
    );
  }

  // Count urgent items (overdue + due_soon) for the header callout
  const urgentCount = actions.filter(
    (a) => a.kind === 'overdue' || a.kind === 'due_soon',
  ).length;

  return (
    <Card padding="sm">
      <div className="mb-2 flex items-center gap-2 px-1">
        <BookOpen className="size-4 text-primary" aria-hidden />
        <h2 className="text-sm font-semibold text-fg">Today</h2>
        {urgentCount > 0 ? (
          <span className="ml-auto rounded-pill bg-danger-soft px-2.5 py-0.5 text-xs font-medium text-danger border border-danger/25">
            {urgentCount} urgent
          </span>
        ) : null}
      </div>

      <div className="flex flex-col">
        {actions.map((action) => (
          <ActionRow key={action.id} action={action} />
        ))}
      </div>
    </Card>
  );
};
