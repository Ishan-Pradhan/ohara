import { Link } from 'react-router-dom';
import { Award, BookOpen, ClipboardList, FileQuestion } from 'lucide-react';

import { useStudentDashboard } from '../../features/dashboard/useDashboard.js';
import type { UpcomingItem, RecentGradeItem } from '../../features/dashboard/dashboard.schema.js';
import { Card } from '../../components/ui/Card.js';
import { Badge } from '../../components/ui/Badge.js';
import { Skeleton } from '../../components/ui/Skeleton.js';
import { EmptyState } from '../../components/ui/EmptyState.js';

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

export const StudentDashboardWidgets = () => {
  const { data, isLoading } = useStudentDashboard(true);

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!data || !data.placed) {
    return null;
  }

  return (
    <div className="flex flex-col gap-4">
      {data.courses.length > 0 ? (
        <Card padding="sm">
          <h2 className="mb-2 px-1 text-sm font-semibold text-fg">My Courses</h2>
          <div className="flex flex-wrap gap-2">
            {data.courses.map((course) => (
              <Link key={course.id} to={`/student/courses/${course.id}`}>
                <Badge variant="primary" className="gap-1.5 px-3 py-1.5">
                  <BookOpen className="size-3.5" aria-hidden />
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
