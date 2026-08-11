import { Brain, TrendingUp, TrendingDown, AlertTriangle, Users, BookOpen, CalendarCheck, ClipboardCheck } from 'lucide-react';

import { useClassIntelligence } from '../../../features/teacherIntelligence/useClassIntelligence.js';
import { Card } from '../../../components/ui/Card.js';
import { Badge } from '../../../components/ui/Badge.js';
import { Skeleton } from '../../../components/ui/Skeleton.js';
import { EmptyState } from '../../../components/ui/EmptyState.js';

interface ClassIntelligenceCardProps {
  courseId: string;
}

const fmtPct = (v: number | null) => (v === null ? '—' : `${v.toFixed(0)}%`);
const fmtNum = (v: number | null) => (v === null ? '—' : v.toFixed(1));

export const ClassIntelligenceCard = ({ courseId }: ClassIntelligenceCardProps) => {
  const { data, isLoading } = useClassIntelligence(courseId);

  if (isLoading) {
    return <Skeleton className="h-64 w-full" />;
  }

  if (!data) {
    return (
      <EmptyState
        icon={Brain}
        title="No data available yet"
        description="Class intelligence will appear once students have grades and attendance records."
      />
    );
  }

  const stats = [
    { label: 'Enrolled', value: data.enrollmentCount, icon: Users, color: 'text-info' },
    { label: 'Class average', value: fmtNum(data.classAverage), icon: BookOpen, color: 'text-fg' },
    { label: 'Attendance', value: fmtPct(data.attendanceRate), icon: CalendarCheck, color: 'text-fg' },
    { label: 'Submissions', value: fmtPct(data.submissionCompletionRate), icon: ClipboardCheck, color: 'text-fg' },
    {
      label: 'At risk',
      value: data.atRiskCount,
      icon: AlertTriangle,
      color: data.atRiskCount > 0 ? 'text-danger' : 'text-success',
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {stats.map((s) => (
          <Card key={s.label} padding="sm" className="flex flex-col gap-1">
            <span className="text-xs text-muted">{s.label}</span>
            <span className={`text-2xl font-semibold ${s.color}`}>
              {s.value}
            </span>
          </Card>
        ))}
      </div>

      {(data.topPerformers.length > 0 || data.bottomPerformers.length > 0) && (
        <div className="grid gap-4 sm:grid-cols-2">
          {data.topPerformers.length > 0 && (
            <Card padding="sm">
              <h4 className="mb-2 flex items-center gap-1.5 text-sm font-medium">
                <TrendingUp className="size-4 text-success" aria-hidden />
                Top Performers
              </h4>
              <ul className="flex flex-col gap-1">
                {data.topPerformers.map((p) => (
                  <li key={p.studentId} className="flex items-center justify-between text-sm">
                    <span>{p.studentName}</span>
                    <Badge variant="success">{p.average.toFixed(0)}%</Badge>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {data.bottomPerformers.length > 0 && (
            <Card padding="sm">
              <h4 className="mb-2 flex items-center gap-1.5 text-sm font-medium">
                <TrendingDown className="size-4 text-warning" aria-hidden />
                Needs Attention
              </h4>
              <ul className="flex flex-col gap-1">
                {data.bottomPerformers.map((p) => (
                  <li key={p.studentId} className="flex items-center justify-between text-sm">
                    <span>{p.studentName}</span>
                    <Badge variant="warning">{p.average.toFixed(0)}%</Badge>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      )}
    </div>
  );
};
