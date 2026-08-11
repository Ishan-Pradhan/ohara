import { Link } from 'react-router-dom';
import { Award, BarChart3, ClipboardList, FileQuestion } from 'lucide-react';

import { useStudentDashboard } from '../../features/dashboard/useDashboard.js';
import { useStudentPlacement } from '../../features/placement/usePlacement.js';
import { useCurrentUser } from '../../features/auth/useAuth.js';
import type {
  UpcomingItem,
  RecentGradeItem,
  PerformanceCourse,
  PerformanceSnapshot,
} from '../../features/dashboard/dashboard.schema.js';

import { Card } from '../../components/ui/Card.js';
import { Badge } from '../../components/ui/Badge.js';
import { Skeleton } from '../../components/ui/Skeleton.js';
import { EmptyState } from '../../components/ui/EmptyState.js';
import { TodayIntelligencePanel } from './TodayIntelligencePanel.js';
import { CourseCardsGrid } from './CourseCardsGrid.js';

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

const PerformanceCourseRow = ({ course }: { course: PerformanceCourse }) => (
  <div className="flex items-center justify-between gap-3 rounded-control bg-surface-hover px-3 py-2">
    <div className="min-w-0">
      <p className="truncate text-sm font-medium text-fg">{course.courseTitle}</p>
      <p className="text-xs text-muted">
        {course.evidence.assessments} assessments · {course.evidence.attendanceRecords} attendance records
      </p>
    </div>
    <div className="flex shrink-0 items-center gap-2">
      <Badge variant="primary">{formatPercent(course.averageGrade)}</Badge>
      <Badge variant="neutral">{formatPercent(course.attendancePercentage)}</Badge>
    </div>
  </div>
);

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

  const visibleCourses = performance.courses.slice(0, 3);

  return (
    <Card padding="sm">
      <h2 className="mb-3 px-1 text-sm font-semibold text-fg">Performance snapshot</h2>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <PerformanceStat label="Average" value={formatPercent(performance.averageGrade)} />
        <PerformanceStat label="Attendance" value={formatPercent(performance.attendancePercentage)} />
        <PerformanceStat label="Completion" value={formatPercent(performance.completionRate)} />
        <PerformanceStat
          label="Missing / late"
          value={`${performance.missingSubmissions} missing · ${performance.lateSubmissions} late`}
        />
      </div>

      <p className="mt-3 px-1 text-xs text-muted">
        Based on {performance.evidence.courses} courses, {performance.evidence.assessments} assessments, and{' '}
        {performance.evidence.attendanceRecords} attendance records.
      </p>

      {visibleCourses.length > 0 ? (
        <div className="mt-4 flex flex-col gap-2">
          {visibleCourses.map((course) => (
            <PerformanceCourseRow key={course.courseId} course={course} />
          ))}
        </div>
      ) : null}
    </Card>
  );
};

export const StudentDashboardWidgets = () => {
  const { data, isLoading } = useStudentDashboard(true);
  const { data: currentUser } = useCurrentUser();
  const { data: placement } = useStudentPlacement(currentUser?.id ?? '');

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-48 w-full" />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if (!data || !data.placed) {
    return null;
  }

  return (
    <div className="flex flex-col gap-4">
      <TodayIntelligencePanel />

      <PerformanceCard performance={data.performance} />

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

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
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
              {data.upcoming.map((item) => (
                <UpcomingRow key={`${item.type}-${item.id}`} item={item} />
              ))}
            </div>
          )}
        </Card>

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
              {data.recentGrades.map((item) => (
                <RecentGradeRow key={`${item.type}-${item.id}`} item={item} />
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};
