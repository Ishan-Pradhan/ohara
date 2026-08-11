import { Link } from 'react-router-dom';
import { Users, BookOpen, CalendarCheck, ClipboardList, AlertTriangle, BarChart3 } from 'lucide-react';

import { useClassIntelligence } from '../../features/teacherIntelligence/useClassIntelligence.js';
import { useGradeTrends } from '../../features/trends/useTrends.js';
import { useAttendanceTrends } from '../../features/trends/useTrends.js';
import { Card } from '../../components/ui/Card.js';
import { Badge } from '../../components/ui/Badge.js';
import { Skeleton } from '../../components/ui/Skeleton.js';
import { EmptyState } from '../../components/ui/EmptyState.js';
import { GradeTrendChart } from '../../components/charts/GradeTrendChart.js';
import { AttendanceTrendChart } from '../../components/charts/AttendanceTrendChart.js';

interface TeacherOverviewSectionProps {
  courseId: string;
}

const fmtPct = (v: number | null) => (v === null ? '—' : `${v.toFixed(0)}%`);
const fmtNum = (v: number | null) => (v === null ? '—' : v.toFixed(1));

export const TeacherOverviewSection = ({ courseId }: TeacherOverviewSectionProps) => {
  const { data: intel, isLoading } = useClassIntelligence(courseId);
  const { data: gradeTrends } = useGradeTrends(courseId);
  const { data: attendanceTrends } = useAttendanceTrends(courseId);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
        </div>
        <Skeleton className="h-48" />
      </div>
    );
  }

  if (!intel) {
    return (
      <EmptyState
        icon={BarChart3}
        title="No data yet"
        description="Course intelligence will appear once students have grades and attendance records."
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card padding="sm">
          <div className="flex items-center gap-2 mb-1">
            <Users className="size-4 text-muted" aria-hidden />
            <span className="text-xs text-muted">Enrolled</span>
          </div>
          <p className="text-2xl font-bold text-fg">{intel.enrollmentCount}</p>
        </Card>
        <Card padding="sm">
          <div className="flex items-center gap-2 mb-1">
            <BookOpen className="size-4 text-muted" aria-hidden />
            <span className="text-xs text-muted">Average</span>
          </div>
          <p className="text-2xl font-bold text-fg">{fmtNum(intel.classAverage)}</p>
        </Card>
        <Card padding="sm">
          <div className="flex items-center gap-2 mb-1">
            <CalendarCheck className="size-4 text-muted" aria-hidden />
            <span className="text-xs text-muted">Attendance</span>
          </div>
          <p className="text-2xl font-bold text-fg">{fmtPct(intel.attendanceRate)}</p>
        </Card>
        <Card padding="sm">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="size-4 text-muted" aria-hidden />
            <span className="text-xs text-muted">At Risk</span>
          </div>
          <p className={`text-2xl font-bold ${intel.atRiskCount > 0 ? 'text-danger' : 'text-fg'}`}>
            {intel.atRiskCount}
          </p>
        </Card>
      </div>

      <div>
        <h2 className="mb-3 text-sm font-semibold text-fg">Quick Actions</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {[
            { label: 'Take Attendance', to: `/admin/courses/${courseId}`, icon: CalendarCheck, color: 'text-success' },
            { label: 'Create Assignment', to: `/admin/courses/${courseId}`, icon: ClipboardList, color: 'text-primary' },
            { label: 'Gradebook', to: `/admin/courses/${courseId}`, icon: BarChart3, color: 'text-accent' },
            { label: 'View Roster', to: `/teacher/courses/${courseId}/students`, icon: Users, color: 'text-info' },
          ].map((action) => (
            <Link key={action.label} to={action.to}>
              <Card className="cursor-pointer transition-colors hover:border-primary/40 group">
                <div className="flex items-center gap-3">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-surface-hover">
                    <action.icon className={`size-4.5 ${action.color}`} aria-hidden />
                  </div>
                  <div className="min-w-0">
                    <span className="text-sm font-medium group-hover:text-primary transition-colors">
                      {action.label}
                    </span>
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      </div>

      {intel.topPerformers.length > 0 && (
        <Card padding="sm">
          <h2 className="mb-2 text-sm font-semibold text-fg">Top Performers</h2>
          <div className="flex flex-col gap-1">
            {intel.topPerformers.slice(0, 5).map((s) => (
              <div key={s.studentId} className="flex items-center justify-between rounded-control px-3 py-2">
                <span className="text-sm text-fg">{s.studentName}</span>
                <Badge variant="success">{s.average !== null ? `${s.average.toFixed(1)}%` : '—'}</Badge>
              </div>
            ))}
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {gradeTrends && <GradeTrendChart data={gradeTrends} />}
        {attendanceTrends && <AttendanceTrendChart data={attendanceTrends} />}
      </div>
    </div>
  );
};
