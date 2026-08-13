import { Card } from '../../components/ui/Card.js';

export interface SectionStat {
  label: string;
  value: string;
  tone?: 'default' | 'success' | 'accent' | 'warning' | 'danger';
}

// Matches lib/pctColor.ts's convention (≥80 success, ≥60 accent, else danger)
// so a percentage reads the same color here as it does everywhere else in
// the app. 'warning' is a separate, duller amber for counts that need
// attention regardless of a percentage (e.g. "3 awaiting grade"), not a
// score tier — text-warning itself is a light fill color, not legible as
// text (see Badge.tsx's own warning variant), so both use text-accent-fg,
// same as Badge does.
const toneClass: Record<NonNullable<SectionStat['tone']>, string> = {
  default: 'text-fg',
  success: 'text-success',
  accent: 'text-accent-fg',
  warning: 'text-accent-fg',
  danger: 'text-danger',
};

/** A row of KPI tiles at the top of a course-page tab (Assignments, Quizzes,
 * Grades) — the same "stat then list" shape across all three so switching
 * tabs doesn't reset the reader's sense of layout. */
export const SectionStats = ({ stats }: { stats: SectionStat[] }) => (
  <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${stats.length}, minmax(0, 1fr))` }}>
    {stats.map((stat) => (
      <Card key={stat.label} padding="sm">
        <p className="text-xs text-subtle">{stat.label}</p>
        <p className={`mt-1 text-2xl font-bold ${toneClass[stat.tone ?? 'default']}`}>{stat.value}</p>
      </Card>
    ))}
  </div>
);
