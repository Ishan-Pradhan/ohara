import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  AlertTriangle,
  ArrowUpDown,
  Building2,
  ChevronRight,
  ClipboardX,
  GraduationCap,
  Lightbulb,
  Loader2,
  RefreshCw,
  TrendingDown,
  TrendingUp,
  Users,
} from 'lucide-react';

import {
  useInstitutionPerformance,
  useGenerateInstitutionPerformanceInsights,
} from '../../features/institution/useInstitutionPerformance.js';
import type {
  InstitutionPerformance,
  ProgramSummary,
  CourseSummary,
} from '../../features/institution/institutionPerformance.schema.js';
import { Card } from '../../components/ui/Card.js';
import { Badge } from '../../components/ui/Badge.js';
import { Button } from '../../components/ui/Button.js';
import { ProgressRing } from '../../components/ui/ProgressRing.js';
import { Skeleton } from '../../components/ui/Skeleton.js';
import { EmptyState } from '../../components/ui/EmptyState.js';
import { Table, TableHead, TableBody, TableRow, TableHeadCell, TableCell } from '../../components/ui/Table.js';
import { cn } from '../../lib/cn.js';

// ──────────────────────────────────────────────────────────────────────────────
// Shared value formatting
// ──────────────────────────────────────────────────────────────────────────────

const fmtPct = (value: number | null) => (value === null ? '—' : `${value.toFixed(1)}%`);

const pctColor = (value: number | null, threshold = 60) => {
  if (value === null) return 'text-muted';
  if (value >= 80) return 'text-success';
  if (value >= threshold) return 'text-accent-fg';
  return 'text-danger';
};

// ──────────────────────────────────────────────────────────────────────────────
// Stat strip
// ──────────────────────────────────────────────────────────────────────────────

const StatTile = ({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number | string;
  icon: React.ComponentType<{ className?: string }>;
  tone: 'primary' | 'accent' | 'danger' | 'success';
}) => {
  const toneClasses = {
    primary: { bg: 'bg-primary-soft', fg: 'text-primary' },
    accent: { bg: 'bg-accent-soft', fg: 'text-accent-fg' },
    danger: { bg: 'bg-danger-soft', fg: 'text-danger' },
    success: { bg: 'bg-success-soft', fg: 'text-success' },
  }[tone];

  return (
    <Card padding="sm">
      <div className="flex items-center gap-3">
        <div className={cn('flex size-9 shrink-0 items-center justify-center rounded-full', toneClasses.bg)}>
          <Icon className={cn('size-4.5', toneClasses.fg)} />
        </div>
        <div>
          <p className="text-xs text-muted">{label}</p>
          <p className="text-xl font-bold text-fg">{value}</p>
        </div>
      </div>
    </Card>
  );
};

// ──────────────────────────────────────────────────────────────────────────────
// Program comparison — bar chart + sortable table
// ──────────────────────────────────────────────────────────────────────────────

type ProgramSortKey = 'name' | 'studentCount' | 'averageGrade' | 'attendanceRate' | 'atRiskCount';

const ProgramChart = ({ programs }: { programs: ProgramSummary[] }) => {
  const data = programs
    .filter((p) => p.averageGrade !== null)
    .map((p) => ({ name: p.name, averageGrade: Math.round(p.averageGrade!) }));

  if (data.length === 0) return null;

  const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ value: number; payload: { name: string } }> }) => {
    if (!active || !payload || payload.length === 0) return null;
    return (
      <div className="rounded-card border border-border bg-surface px-3 py-2 text-xs shadow-md">
        <p className="mb-1 font-medium text-fg">{payload[0]?.payload.name}</p>
        <p className="text-muted">
          Avg grade: <span className="font-medium text-fg">{payload[0]?.value}%</span>
        </p>
      </div>
    );
  };

  return (
    <Card padding="sm">
      <h2 className="mb-3 text-sm font-semibold text-fg">Average Grade by Program</h2>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
          <XAxis dataKey="name" tick={{ fontSize: 12 }} className="text-muted" />
          <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} className="text-muted" tickFormatter={(v: number) => `${v}%`} />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'var(--color-surface-hover)' }} />
          <Bar dataKey="averageGrade" fill="#2563eb" radius={[4, 4, 0, 0]} maxBarSize={48} />
        </BarChart>
      </ResponsiveContainer>
    </Card>
  );
};

const ProgramsTable = ({ programs }: { programs: ProgramSummary[] }) => {
  const [sortKey, setSortKey] = useState<ProgramSortKey>('studentCount');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const toggleSort = (key: ProgramSortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir(key === 'name' ? 'asc' : 'desc');
    }
  };

  const sorted = useMemo(() => {
    return [...programs].sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case 'name':
          cmp = a.name.localeCompare(b.name);
          break;
        case 'studentCount':
          cmp = a.studentCount - b.studentCount;
          break;
        case 'averageGrade':
          cmp = (a.averageGrade ?? -1) - (b.averageGrade ?? -1);
          break;
        case 'attendanceRate':
          cmp = (a.attendanceRate ?? -1) - (b.attendanceRate ?? -1);
          break;
        case 'atRiskCount':
          cmp = a.atRiskCount - b.atRiskCount;
          break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [programs, sortKey, sortDir]);

  const SortHeader = ({ label, field }: { label: string; field: ProgramSortKey }) => (
    <TableHeadCell className="cursor-pointer select-none hover:text-fg transition-colors" onClick={() => toggleSort(field)}>
      <span className="inline-flex items-center gap-1">
        {label}
        <ArrowUpDown className={cn('size-3', sortKey === field ? 'text-fg' : 'text-muted/50')} />
      </span>
    </TableHeadCell>
  );

  return (
    <Card padding="sm">
      <h2 className="mb-3 text-sm font-semibold text-fg">Programs</h2>
      <Table>
        <TableHead>
          <TableRow>
            <SortHeader label="Program" field="name" />
            <TableHeadCell>Courses</TableHeadCell>
            <SortHeader label="Students" field="studentCount" />
            <SortHeader label="Avg Grade" field="averageGrade" />
            <SortHeader label="Attendance" field="attendanceRate" />
            <SortHeader label="At-Risk" field="atRiskCount" />
          </TableRow>
        </TableHead>
        <TableBody>
          {sorted.map((p) => (
            <TableRow key={p.name}>
              <TableCell className="font-medium">{p.name}</TableCell>
              <TableCell className="text-muted">{p.courseCount}</TableCell>
              <TableCell className="text-muted">{p.studentCount}</TableCell>
              <TableCell>
                <span className={pctColor(p.averageGrade)}>{fmtPct(p.averageGrade)}</span>
              </TableCell>
              <TableCell>
                <span className={pctColor(p.attendanceRate)}>{fmtPct(p.attendanceRate)}</span>
              </TableCell>
              <TableCell>
                {p.atRiskCount > 0 ? <Badge variant="danger">{p.atRiskCount}</Badge> : <span className="text-subtle">0</span>}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
};

// ──────────────────────────────────────────────────────────────────────────────
// Top / bottom courses
// ──────────────────────────────────────────────────────────────────────────────

const CourseListCard = ({
  title,
  icon: Icon,
  iconClassName,
  courses,
  emptyLabel,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  iconClassName: string;
  courses: CourseSummary[];
  emptyLabel: string;
}) => (
  <Card padding="sm">
    <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-fg">
      <Icon className={cn('size-4', iconClassName)} />
      {title}
    </h2>
    {courses.length === 0 ? (
      <p className="py-2 text-sm text-muted">{emptyLabel}</p>
    ) : (
      <div className="flex flex-col divide-y divide-border">
        {courses.map((c) => (
          <Link
            key={c.courseId}
            to={`/admin/courses/${c.courseId}`}
            className="flex items-center justify-between gap-3 py-2 text-sm transition-colors hover:text-primary"
          >
            <span className="min-w-0 truncate text-fg">{c.name}</span>
            <span className="flex shrink-0 items-center gap-2">
              <span className="text-xs text-subtle">{c.enrollmentCount} students</span>
              <span className={cn('font-medium', pctColor(c.averageGrade))}>{fmtPct(c.averageGrade)}</span>
            </span>
          </Link>
        ))}
      </div>
    )}
  </Card>
);

// ──────────────────────────────────────────────────────────────────────────────
// AI insights — mirrors the teacher dashboard's insights card: explicit
// generate/refresh only, header always states exactly when it was last run.
// ──────────────────────────────────────────────────────────────────────────────

const InsightList = ({ items, dotClassName }: { items: string[]; dotClassName: string }) => {
  if (items.length === 0) return null;
  return (
    <ul className="flex flex-col gap-1.5">
      {items.map((item) => (
        <li key={item} className="flex items-start gap-2 text-sm text-fg">
          <span className={cn('mt-1.5 size-1.5 shrink-0 rounded-full', dotClassName)} aria-hidden />
          {item}
        </li>
      ))}
    </ul>
  );
};

const InsightsCard = ({ perf }: { perf: InstitutionPerformance }) => {
  const { mutate: generate, isPending } = useGenerateInstitutionPerformanceInsights();
  const { insights, insightsGeneratedAt } = perf;

  const refreshButton = (
    <Button size="sm" variant="secondary" onClick={() => generate()} disabled={isPending}>
      {isPending ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <RefreshCw className="size-3.5" aria-hidden />}
      {insights ? 'Refresh' : 'Generate'}
    </Button>
  );

  if (!insights) {
    return (
      <Card padding="sm">
        <EmptyState
          icon={Lightbulb}
          title="No AI insights yet"
          description="Generate a summary of institution-wide highlights, concerns, and recommended actions. Only runs when you ask — never automatically."
          action={refreshButton}
        />
      </Card>
    );
  }

  return (
    <div className="rounded-card border border-primary/20 bg-primary/5 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-primary">
          <Lightbulb className="size-3.5" aria-hidden />
          AI insights
        </p>
        <div className="flex items-center gap-2">
          {insightsGeneratedAt ? (
            <span className="text-xs text-subtle">
              Generated {formatDistanceToNow(new Date(insightsGeneratedAt), { addSuffix: true })}
            </span>
          ) : null}
          {refreshButton}
        </div>
      </div>

      <p className="text-sm leading-relaxed text-fg">{insights.summary}</p>

      {insights.highlights.length > 0 ? (
        <div className="mt-3">
          <p className="mb-1.5 text-xs font-semibold text-success">Highlights</p>
          <InsightList items={insights.highlights} dotClassName="bg-success" />
        </div>
      ) : null}

      {insights.concerns.length > 0 ? (
        <div className="mt-3">
          <p className="mb-1.5 text-xs font-semibold text-danger">Concerns</p>
          <InsightList items={insights.concerns} dotClassName="bg-danger" />
        </div>
      ) : null}

      {insights.recommendations.length > 0 ? (
        <div className="mt-3">
          <p className="mb-1.5 text-xs font-semibold text-fg">Recommended actions</p>
          <ul className="flex flex-col gap-1.5">
            {insights.recommendations.map((rec) => (
              <li key={rec} className="flex items-start gap-2 text-sm text-fg">
                <ChevronRight className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                {rec}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
};

// ──────────────────────────────────────────────────────────────────────────────
// Tab exports — Overview (stat strip, health row, AI insights) and
// Programs & Courses (comparison chart/table, top/bottom courses) are split
// into separate Analytics tabs by AdminAnalyticsPage.tsx rather than one
// long scrolling page. Both call useInstitutionPerformance() independently;
// react-query dedupes the underlying fetch.
// ──────────────────────────────────────────────────────────────────────────────

export const InstitutionOverviewTab = () => {
  const { data: perf, isLoading, error } = useInstitutionPerformance();

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Skeleton className="h-20" /><Skeleton className="h-20" /><Skeleton className="h-20" /><Skeleton className="h-20" />
        </div>
        <Skeleton className="h-56" />
      </div>
    );
  }

  if (error || !perf) {
    return (
      <EmptyState icon={Building2} title="Unavailable" description="Could not load institution performance data." />
    );
  }

  const { totals, academic } = perf;

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile icon={GraduationCap} label="Programs" value={totals.programs} tone="primary" />
        <StatTile icon={Building2} label="Courses" value={totals.courses} tone="primary" />
        <StatTile icon={Users} label="Students" value={totals.students} tone="accent" />
        <StatTile icon={Users} label="Teachers" value={totals.teachers} tone="accent" />
      </div>

      <Card padding="sm">
        <div className="flex flex-col items-center gap-6 sm:flex-row sm:justify-around">
          <div className="flex items-center gap-3">
            <ProgressRing value={academic.overallAverageGrade ?? 0} label="Overall average grade" />
            <div>
              <p className="text-sm font-medium text-fg">Overall Average</p>
              <p className="text-xs text-muted">Across all courses</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <ProgressRing value={academic.overallAttendanceRate ?? 0} label="Overall attendance rate" />
            <div>
              <p className="text-sm font-medium text-fg">Attendance</p>
              <p className="text-xs text-muted">Across all courses</p>
            </div>
          </div>
          <div className="flex gap-3">
            <StatTile
              icon={AlertTriangle}
              label="At-Risk"
              value={academic.totalAtRisk}
              tone={academic.totalAtRisk > 0 ? 'danger' : 'success'}
            />
            <StatTile
              icon={ClipboardX}
              label="Missing Subs"
              value={academic.totalMissingSubmissions}
              tone={academic.totalMissingSubmissions > 0 ? 'danger' : 'success'}
            />
          </div>
        </div>
      </Card>

      <InsightsCard perf={perf} />
    </div>
  );
};

export const InstitutionProgramsTab = () => {
  const { data: perf, isLoading, error } = useInstitutionPerformance();

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-56" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (error || !perf) {
    return (
      <EmptyState icon={Building2} title="Unavailable" description="Could not load institution performance data." />
    );
  }

  const { programs, topCourses, bottomCourses } = perf;

  if (programs.length === 0 && topCourses.length === 0 && bottomCourses.length === 0) {
    return (
      <EmptyState icon={GraduationCap} title="No data yet" description="Program and course breakdowns appear here once courses have enrolled students." />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {programs.length > 0 && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <ProgramChart programs={programs} />
          <ProgramsTable programs={programs} />
        </div>
      )}

      {(topCourses.length > 0 || bottomCourses.length > 0) && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <CourseListCard
            title="Top Courses"
            icon={TrendingUp}
            iconClassName="text-success"
            courses={topCourses}
            emptyLabel="No graded courses yet."
          />
          <CourseListCard
            title="Courses Needing Attention"
            icon={TrendingDown}
            iconClassName="text-danger"
            courses={bottomCourses}
            emptyLabel="No graded courses yet."
          />
        </div>
      )}
    </div>
  );
};
