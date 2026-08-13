import { CalendarCheck } from 'lucide-react';

import { useMyAttendance } from '../../features/attendance/useAttendance.js';
import { Card } from '../../components/ui/Card.js';
import { Badge } from '../../components/ui/Badge.js';
import { ProgressRing } from '../../components/ui/ProgressRing.js';
import { Skeleton } from '../../components/ui/Skeleton.js';
import { EmptyState } from '../../components/ui/EmptyState.js';
import { pctColor } from '../../lib/pctColor.js';

interface StudentAttendanceSectionProps {
  courseId: string;
}

export const StudentAttendanceSection = ({ courseId }: StudentAttendanceSectionProps) => {
  const { data: attendance, isLoading } = useMyAttendance(courseId);

  if (isLoading) {
    return <Skeleton className="h-32 w-full" />;
  }

  if (!attendance || attendance.total === 0) {
    return (
      <EmptyState
        icon={CalendarCheck}
        title="No sessions yet"
        description="Your attendance will appear here once your teacher takes it."
      />
    );
  }

  const pct = attendance.percentage;
  const total = attendance.present + attendance.late + attendance.absent;
  const presentPct = total > 0 ? (attendance.present / total) * 100 : 0;
  const latePct = total > 0 ? (attendance.late / total) * 100 : 0;
  const absentPct = total > 0 ? (attendance.absent / total) * 100 : 0;

  return (
    <Card>
      <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:gap-8">
        <div className="flex items-center gap-4">
          <ProgressRing
            value={pct ?? 0}
            size={72}
            strokeWidth={7}
            label="Your attendance"
          />
          <div>
            <p className="text-xs text-subtle">Attendance</p>
            <p className={`text-2xl font-bold ${pctColor(pct)}`}>
              {pct === null ? '—' : `${pct.toFixed(0)}%`}
            </p>
            <p className="text-xs text-muted">{attendance.total} session{attendance.total !== 1 ? 's' : ''}</p>
          </div>
        </div>

        <div className="h-px w-full bg-border sm:h-8 sm:w-px" />

        <div className="flex flex-1 flex-col gap-3">
          <div className="flex items-center gap-4">
            <Badge variant="success">{attendance.present} present</Badge>
            <Badge variant="warning">{attendance.late} late</Badge>
            <Badge variant="danger">{attendance.absent} absent</Badge>
          </div>

          {total > 0 ? (
            <div className="flex h-2.5 overflow-hidden rounded-full bg-surface-hover">
              {presentPct > 0 ? (
                <div
                  className="bg-success transition-all duration-500"
                  style={{ width: `${presentPct}%` }}
                />
              ) : null}
              {latePct > 0 ? (
                <div
                  className="bg-warning transition-all duration-500"
                  style={{ width: `${latePct}%` }}
                />
              ) : null}
              {absentPct > 0 ? (
                <div
                  className="bg-danger transition-all duration-500"
                  style={{ width: `${absentPct}%` }}
                />
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </Card>
  );
};
