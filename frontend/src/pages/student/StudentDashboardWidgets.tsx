import { Link } from 'react-router-dom';
import { Award, BarChart3, ClipboardList, FileQuestion } from 'lucide-react';

import { useStudentDashboard } from '../../features/dashboard/useDashboard.js';
import { useStudentPlacement } from '../../features/placement/usePlacement.js';
import { useCurrentUser } from '../../features/auth/useAuth.js';
import type {
  UpcomingItem,
  RecentGradeItem,
  PerformanceSnapshot,
} from '../../features/dashboard/dashboard.schema.js';

import { Card } from '../../components/ui/Card.js';
import { Badge } from '../../components/ui/Badge.js';
import { Skeleton } from '../../components/ui/Skeleton.js';
import { EmptyState } from '../../components/ui/EmptyState.js';
import { TodayIntelligencePanel } from './TodayIntelligencePanel.js';
import { CourseCardsGrid } from './CourseCardsGrid.js';
import { EventsWidget } from '../EventsWidget.js';

// Both lists come back unbounded from the API — cap what the dashboard
// itself renders (same convention as EventsWidget's 5) so a busy student
// with a dozen courses doesn't turn the dashboard into an endless list.
const MAX_LIST_ITEMS = 5;

const itemLink = (item: { type: 'assignment' | 'quiz'; courseId: string; id: string }) =>
  `/student/courses/${item.courseId}/${item.type === 'assignment' ? 'assignments' : 'quizzes'}/${item.id}`;

const UpcomingRow = ({ item }: { item: UpcomingItem }) => (
  <Link
    to={itemLink(item)}
    className="flex items-center justify-between gap-3 rounded-control px-3 py-2.5 transition-colors hover:bg-surface-hover"
  >
    <div className="flex items-center gap-3 overflow-hidden">
      <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary-soft">
        {item.type === 'assignment' ? (
          <ClipboardList className="size-4 text-primary" aria-hidden />
        ) : (
          <FileQuestion className="size-4 text-primary" aria-hidden />
        )}
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-fg">{item.title}</p>
        <p className="truncate text-xs text-muted">{item.courseTitle}</p>
      </div>
    </div>
    {item.dueAt ? (
      <span className="shrink-0 text-xs text-subtle">
        Due {new Date(item.dueAt).toLocaleDateString()}
      </span>
    ) : (
      <Badge variant="neutral">Not attempted</Badge>
    )}
  </Link>
);

const RecentGradeRow = ({ item }: { item: RecentGradeItem }) => {
  const pct = item.maxScore > 0 ? Math.round((item.score / item.maxScore) * 100) : 0;
  const variant = pct >= 80 ? 'success' : pct >= 50 ? 'warning' : 'danger';
  return (
    <Link
      to={itemLink(item)}
      className="flex items-center justify-between gap-3 rounded-control px-3 py-2.5 transition-colors hover:bg-surface-hover"
    >
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-fg">{item.title}</p>
        <p className="truncate text-xs text-muted">{item.courseTitle}</p>
      </div>
      <Badge variant={variant} className="shrink-0">
        {item.score}/{item.maxScore}
      </Badge>
    </Link>
  );
};

const formatPercent = (value: number | null) => (value === null ? '—' : `${value.toFixed(1)}%`);

const PerformanceStat = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-card border border-border bg-surface px-3 py-2">
    <p className="text-xs text-subtle">{label}</p>
    <p className="mt-1 text-sm font-semibold text-fg">{value}</p>
  </div>
);

// Per-course averages already live on each card in CourseCardsGrid below —
// repeating them here was the same numbers twice on one screen. This card
// stays to the aggregate snapshot only.
const PerformanceCard = ({ performance }: { performance: PerformanceSnapshot }) => {
  if (performance.status === 'insufficient_data') {
    return (
      <Card padding="sm">
        <h2 className="mb-2 px-1 text-sm font-semibold text-fg">Performance snapshot</h2>
        <EmptyState
          icon={BarChart3}
          title="Not enough evidence yet"
          description="Once you have grades, quiz attempts, or attendance, this snapshot will show how you're doing."
        />
      </Card>
    );
  }

  return (
    <Card padding="sm">
      <h2 className="mb-3 px-1 text-sm font-semibold text-fg">Performance snapshot</h2>

      <div className="grid grid-cols-2 gap-3">
        <PerformanceStat label="Average" value={formatPercent(performance.averageGrade)} />
        <PerformanceStat label="Attendance" value={formatPercent(performance.attendancePercentage)} />
        <PerformanceStat label="Completion" value={formatPercent(performance.completionRate)} />
        <PerformanceStat
          label="Missing / late"
          value={`${performance.missingSubmissions} · ${performance.lateSubmissions}`}
        />
      </div>

      <p className="mt-3 px-1 text-xs text-muted">
        Based on {performance.evidence.courses} courses, {performance.evidence.assessments} assessments, and{' '}
        {performance.evidence.attendanceRecords} attendance records.
      </p>
    </Card>
  );
};

export const StudentDashboardWidgets = () => {
  const { data, isLoading } = useStudentDashboard(true);
  const { data: currentUser } = useCurrentUser();
  const { data: placement } = useStudentPlacement(currentUser?.id ?? '');

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="flex flex-col gap-4 lg:col-span-2">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
        <div className="flex flex-col gap-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      </div>
    );
  }

  if (!data || !data.placed) {
    return null;
  }

  const visibleUpcoming = data.upcoming.slice(0, MAX_LIST_ITEMS);
  const visibleGrades = data.recentGrades.slice(0, MAX_LIST_ITEMS);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 lg:items-start">
      {/* Main column: what to act on, then what you're taking. */}
      <div className="flex flex-col gap-4 lg:col-span-2">
        <TodayIntelligencePanel />

        <Card padding="sm">
          <h2 className="mb-1 px-1 text-sm font-semibold text-fg">Up next</h2>
          {data.upcoming.length === 0 ? (
            <EmptyState
              icon={ClipboardList}
              title="All caught up"
              description="No pending assignments or quizzes."
            />
          ) : (
            <div className="flex flex-col">
              {visibleUpcoming.map((item) => (
                <UpcomingRow key={`${item.type}-${item.id}`} item={item} />
              ))}
            </div>
          )}
          {data.upcoming.length > MAX_LIST_ITEMS ? (
            <p className="mt-1 px-3 text-xs text-subtle">
              Showing {MAX_LIST_ITEMS} of {data.upcoming.length} — open a course for the rest.
            </p>
          ) : null}
        </Card>

        {placement && placement.courses.length > 0 ? (
          <CourseCardsGrid
            courses={placement.courses}
            performanceCourses={data.performance.courses}
          />
        ) : data.courses.length > 0 ? (
          <Card padding="sm">
            <h2 className="mb-2 px-1 text-sm font-semibold text-fg">My Courses</h2>
            <div className="flex flex-wrap gap-2">
              {data.courses.map((course) => (
                <Link key={course.id} to={`/student/courses/${course.id}`}>
                  <Badge variant="primary" className="gap-1.5 px-3 py-1.5">
                    {course.title}
                  </Badge>
                </Link>
              ))}
            </div>
          </Card>
        ) : null}
      </div>

      {/* Sidebar: reference info that doesn't need daily action. */}
      <div className="flex flex-col gap-4">
        <PerformanceCard performance={data.performance} />

        <Card padding="sm">
          <h2 className="mb-1 px-1 text-sm font-semibold text-fg">Recent grades</h2>
          {data.recentGrades.length === 0 ? (
            <EmptyState
              icon={Award}
              title="No grades yet"
              description="Approved grades will show up here."
            />
          ) : (
            <div className="flex flex-col">
              {visibleGrades.map((item) => (
                <RecentGradeRow key={`${item.type}-${item.id}`} item={item} />
              ))}
            </div>
          )}
        </Card>

        <EventsWidget />
      </div>
    </div>
  );
};
