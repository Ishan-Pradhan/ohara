import { Link } from 'react-router-dom';
import { BarChart3, ArrowRight } from 'lucide-react';

import type { PerformanceSnapshot } from '../../features/dashboard/dashboard.schema.js';
import { Card } from '../../components/ui/Card.js';
import { Badge } from '../../components/ui/Badge.js';
import { EmptyState } from '../../components/ui/EmptyState.js';

interface CrossCourseGradesCardProps {
  performance: PerformanceSnapshot;
}

export const CrossCourseGradesCard = ({ performance }: CrossCourseGradesCardProps) => {
  if (performance.status === 'insufficient_data') {
    return (
      <Card padding="sm">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-fg">Grades overview</h2>
          <Link to="/gradebook" className="flex items-center gap-1 text-xs text-primary hover:underline">
            Gradebook <ArrowRight className="size-3" aria-hidden />
          </Link>
        </div>
        <EmptyState
          icon={BarChart3}
          title="Not enough data"
          description="Grades across all courses will appear here once you have graded assessments."
        />
      </Card>
    );
  }

  const gradedCourses = performance.courses.filter((c) => c.averageGrade !== null);

  return (
    <Card padding="sm">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-fg">Grades overview</h2>
        <Link to="/gradebook" className="flex items-center gap-1 text-xs text-primary hover:underline">
          Gradebook <ArrowRight className="size-3" aria-hidden />
        </Link>
      </div>

      <div className="mt-3 flex items-center gap-4">
        <div className="rounded-card border border-border bg-surface px-4 py-3 text-center">
          <p className="text-xs text-subtle">Overall average</p>
          <p className="mt-1 text-2xl font-bold text-fg">
            {performance.averageGrade !== null ? `${performance.averageGrade.toFixed(1)}%` : '—'}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-xs text-subtle">Attendance</p>
            <p className="font-medium text-fg">
              {performance.attendancePercentage !== null ? `${performance.attendancePercentage.toFixed(0)}%` : '—'}
            </p>
          </div>
          <div>
            <p className="text-xs text-subtle">Completion</p>
            <p className="font-medium text-fg">
              {performance.completionRate !== null ? `${performance.completionRate.toFixed(0)}%` : '—'}
            </p>
          </div>
          <div>
            <p className="text-xs text-subtle">Missing</p>
            <p className="font-medium text-fg">{performance.missingSubmissions}</p>
          </div>
          <div>
            <p className="text-xs text-subtle">Late</p>
            <p className="font-medium text-fg">{performance.lateSubmissions}</p>
          </div>
        </div>
      </div>

      {gradedCourses.length > 0 ? (
        <div className="mt-4 flex flex-col gap-1.5">
          {gradedCourses.map((course) => {
            const pct = course.averageGrade!;
            const variant = pct >= 80 ? 'success' : pct >= 50 ? 'warning' : 'danger';
            return (
              <Link
                key={course.courseId}
                to={`/student/courses/${course.courseId}`}
                className="flex items-center justify-between gap-2 rounded-control px-3 py-2 transition-colors hover:bg-surface-hover"
              >
                <span className="truncate text-sm text-fg">{course.courseTitle}</span>
                <Badge variant={variant} className="shrink-0">
                  {pct.toFixed(1)}%
                </Badge>
              </Link>
            );
          })}
        </div>
      ) : null}
    </Card>
  );
};
