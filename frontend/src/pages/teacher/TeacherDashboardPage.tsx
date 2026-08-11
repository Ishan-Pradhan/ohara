import { BarChart3, Users, AlertTriangle, BookOpen } from 'lucide-react';
import { useTeacherDashboard } from '../../features/teacherIntelligence/useTeacherDashboard.js';
import { Card } from '../../components/ui/Card.js';
import { Badge } from '../../components/ui/Badge.js';
import { Skeleton } from '../../components/ui/Skeleton.js';
import { EmptyState } from '../../components/ui/EmptyState.js';
import { Link } from 'react-router-dom';

function StatCard({ label, value, icon: Icon }: { label: string; value: string | number; icon: React.ComponentType<{ className?: string }> }) {
  return (
    <Card>
      <div className="flex items-center gap-2 mb-1">
        <Icon className="size-4 text-muted" aria-hidden />
        <span className="text-xs text-muted">{label}</span>
      </div>
      <p className="text-2xl font-bold">{value}</p>
    </Card>
  );
}

export const TeacherDashboardPage = () => {
  const { data: dashboard, isLoading, error } = useTeacherDashboard();

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-3 gap-4">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
        <Skeleton className="h-48" />
      </div>
    );
  }

  if (error || !dashboard) {
    return (
      <EmptyState
        icon={BarChart3}
        title="Dashboard unavailable"
        description="Could not load the teacher dashboard."
      />
    );
  }

  const { insights } = dashboard;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">Teacher Dashboard</h1>

      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard icon={BookOpen} label="Courses" value={dashboard.totalCourses} />
        <StatCard icon={Users} label="Total Students" value={dashboard.totalStudents} />
        <StatCard icon={AlertTriangle} label="At-Risk Students" value={dashboard.totalAtRisk} />
      </div>

      {/* Course cards */}
      <div>
        <h2 className="text-lg font-semibold mb-3">Course Overview</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {dashboard.courses.map((course) => (
            <Card key={course.courseId}>
              <div className="flex items-center justify-between mb-3">
                <Link
                  to={`/admin/courses/${course.courseId}`}
                  className="text-sm font-semibold hover:underline"
                >
                  {course.courseName}
                </Link>
                {course.atRiskCount > 0 && (
                  <Badge variant="danger">{course.atRiskCount} at-risk</Badge>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <p className="text-muted text-xs">Class Average</p>
                  <p className="font-medium">{course.classAverage !== null ? `${course.classAverage.toFixed(1)}%` : 'N/A'}</p>
                </div>
                <div>
                  <p className="text-muted text-xs">Attendance</p>
                  <p className="font-medium">{course.attendanceRate !== null ? `${course.attendanceRate.toFixed(1)}%` : 'N/A'}</p>
                </div>
                <div>
                  <p className="text-muted text-xs">Students</p>
                  <p className="font-medium">{course.enrollmentCount}</p>
                </div>
              </div>
              {course.topPerformers.length > 0 && (
                <div className="mt-3 text-xs">
                  <p className="text-muted">Top performers: {course.topPerformers.map((s) => s.studentName).join(', ')}</p>
                </div>
              )}
            </Card>
          ))}
        </div>
      </div>

      {/* AI Insights */}
      {insights && (
        <Card>
          <h2 className="text-sm font-semibold mb-2">AI Insights</h2>
          <p className="text-sm text-muted mb-2">{insights.summary}</p>
          {insights.highlights.length > 0 && (
            <div className="mb-2">
              <p className="text-xs font-medium text-muted uppercase mb-1">Highlights</p>
              <ul className="list-disc list-inside text-sm">
                {insights.highlights.map((h, i) => <li key={i}>{h}</li>)}
              </ul>
            </div>
          )}
          {insights.concerns.length > 0 && (
            <div className="mb-2">
              <p className="text-xs font-medium text-muted uppercase mb-1">Concerns</p>
              <ul className="list-disc list-inside text-sm">
                {insights.concerns.map((c, i) => <li key={i}>{c}</li>)}
              </ul>
            </div>
          )}
          {insights.recommendations.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted uppercase mb-1">Recommendations</p>
              <ul className="list-disc list-inside text-sm">
                {insights.recommendations.map((r, i) => <li key={i}>{r}</li>)}
              </ul>
            </div>
          )}
        </Card>
      )}
    </div>
  );
};
