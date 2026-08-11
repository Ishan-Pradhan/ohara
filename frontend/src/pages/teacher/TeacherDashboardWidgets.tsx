import { Link } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  BookOpen,
  ChevronRight,
  Lightbulb,
  Loader2,
  RefreshCw,
  TrendingDown,
  TrendingUp,
  Users,
} from 'lucide-react';

import {
  useTeacherDashboard,
  useGenerateTeacherDashboardInsights,
} from '../../features/teacherIntelligence/useTeacherDashboard.js';
import type { TeacherDashboard as TeacherDashboardData } from '../../features/teacherIntelligence/teacherDashboard.schema.js';
import { Card } from '../../components/ui/Card.js';
import { Badge } from '../../components/ui/Badge.js';
import { Button } from '../../components/ui/Button.js';
import { ProgressRing } from '../../components/ui/ProgressRing.js';
import { Skeleton } from '../../components/ui/Skeleton.js';
import { EmptyState } from '../../components/ui/EmptyState.js';
import { cn } from '../../lib/cn.js';

type CourseSummary = TeacherDashboardData['courses'][number];

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
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  tone: 'primary' | 'accent' | 'danger';
}) => (
  <Card padding="sm">
    <div className="flex items-center gap-3">
      <div
        className={
          tone === 'primary'
            ? 'flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-soft'
            : tone === 'accent'
              ? 'flex size-9 shrink-0 items-center justify-center rounded-full bg-accent-soft'
              : 'flex size-9 shrink-0 items-center justify-center rounded-full bg-danger-soft'
        }
      >
        <Icon
          className={
            tone === 'primary'
              ? 'size-4.5 text-primary'
              : tone === 'accent'
                ? 'size-4.5 text-accent-fg'
                : 'size-4.5 text-danger'
          }
        />
      </div>
      <div>
        <p className="text-xs text-muted">{label}</p>
        <p className="text-xl font-bold text-fg">{value}</p>
      </div>
    </div>
  </Card>
);

// ──────────────────────────────────────────────────────────────────────────────
// Course card
// ──────────────────────────────────────────────────────────────────────────────

const StudentChipList = ({
  label,
  icon: Icon,
  tone,
  students,
}: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: 'success' | 'danger';
  students: { studentId: string; studentName: string; average: number | null }[];
}) => {
  if (students.length === 0) return null;
  return (
    <div className="flex items-start gap-1.5">
      <Icon
        className={tone === 'success' ? 'mt-0.5 size-3.5 shrink-0 text-success' : 'mt-0.5 size-3.5 shrink-0 text-danger'}
        aria-hidden
      />
      <p className="min-w-0 text-xs text-muted">
        <span className="font-medium text-subtle">{label}: </span>
        {students.map((s) => s.studentName).join(', ')}
      </p>
    </div>
  );
};

const TeacherCourseCard = ({ course }: { course: CourseSummary }) => (
  <Link to={`/teacher/courses/${course.courseId}`}>
    <Card className="group cursor-pointer transition-colors hover:border-primary/40">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-semibold text-fg transition-colors group-hover:text-primary">
            {course.courseName}
          </h3>
          <p className="mt-0.5 text-xs text-muted">
            {course.enrollmentCount} student{course.enrollmentCount === 1 ? '' : 's'}
          </p>
        </div>
        {course.classAverage !== null ? (
          <ProgressRing value={course.classAverage} size={40} strokeWidth={4} className="shrink-0" />
        ) : null}
      </div>

      <div className="mt-3 flex items-center gap-4 border-t border-border pt-3 text-xs text-muted">
        <span>
          Attendance{' '}
          <span className="font-medium text-fg">
            {course.attendanceRate !== null ? `${course.attendanceRate.toFixed(0)}%` : '—'}
          </span>
        </span>
        {course.atRiskCount > 0 ? (
          <Badge variant="danger">{course.atRiskCount} at-risk</Badge>
        ) : null}
      </div>

      {course.topPerformers.length > 0 || course.bottomPerformers.length > 0 ? (
        <div className="mt-2 flex flex-col gap-1">
          <StudentChipList label="Top" icon={TrendingUp} tone="success" students={course.topPerformers} />
          {course.atRiskCount > 0 ? (
            <StudentChipList label="Needs support" icon={TrendingDown} tone="danger" students={course.bottomPerformers} />
          ) : null}
        </div>
      ) : null}
    </Card>
  </Link>
);

// ──────────────────────────────────────────────────────────────────────────────
// AI insights — one flowing block (mirrors ExamPrepCard's "AI analysis"
// treatment) rather than a grid of boxes, with an explicit generate/refresh
// control: this is never generated automatically, only on request, so the
// header always says exactly when it was last generated.
// ──────────────────────────────────────────────────────────────────────────────

const InsightList = ({
  items,
  dotClassName,
}: {
  items: string[];
  dotClassName: string;
}) => {
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

const TeacherInsightsCard = ({ dashboard }: { dashboard: TeacherDashboardData }) => {
  const { mutate: generate, isPending } = useGenerateTeacherDashboardInsights();
  const { insights, insightsGeneratedAt } = dashboard;

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
          description="Generate a summary of highlights, concerns, and recommended actions across your courses. Only runs when you ask — never automatically."
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
// Main export
// ──────────────────────────────────────────────────────────────────────────────

export const TeacherDashboardWidgets = () => {
  const { data: dashboard, isLoading, error } = useTeacherDashboard();

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-3 gap-3">
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
        </div>
        <Skeleton className="h-48" />
      </div>
    );
  }

  if (error || !dashboard) {
    return (
      <Card padding="sm">
        <EmptyState
          icon={BarChart3}
          title="Dashboard unavailable"
          description="Could not load your dashboard data."
        />
      </Card>
    );
  }

  if (dashboard.totalCourses === 0) {
    return (
      <Card padding="sm">
        <EmptyState
          icon={BookOpen}
          title="No courses yet"
          description="Once you're assigned to teach a course, it'll show up here."
        />
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-3 gap-3">
        <StatTile label="Courses" value={dashboard.totalCourses} icon={BookOpen} tone="primary" />
        <StatTile label="Students" value={dashboard.totalStudents} icon={Users} tone="accent" />
        <StatTile label="At-risk" value={dashboard.totalAtRisk} icon={AlertTriangle} tone="danger" />
      </div>

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-fg">Your courses</h2>
          <Link to="/teacher/courses" className="flex items-center gap-1 text-xs font-medium text-primary hover:underline">
            View all <ArrowRight className="size-3.5" aria-hidden />
          </Link>
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {dashboard.courses.map((course) => (
            <TeacherCourseCard key={course.courseId} course={course} />
          ))}
        </div>
      </div>

      <TeacherInsightsCard dashboard={dashboard} />
    </div>
  );
};
