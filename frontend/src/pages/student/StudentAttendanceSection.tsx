import { CalendarCheck } from 'lucide-react';

import { useMyAttendance } from '../../features/attendance/useAttendance.js';
import { Card } from '../../components/ui/Card.js';
import { Skeleton } from '../../components/ui/Skeleton.js';
import { EmptyState } from '../../components/ui/EmptyState.js';

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

  return (
    <Card>
      <div className="grid grid-cols-2 gap-x-8 gap-y-4 sm:grid-cols-4">
        <div>
          <p className="text-xs text-subtle">Percentage</p>
          <p className="text-2xl font-semibold text-fg">{attendance.percentage?.toFixed(0)}%</p>
        </div>
        <div>
          <p className="text-xs text-subtle">Present</p>
          <p className="text-sm font-medium text-fg">{attendance.present}</p>
        </div>
        <div>
          <p className="text-xs text-subtle">Late</p>
          <p className="text-sm font-medium text-fg">{attendance.late}</p>
        </div>
        <div>
          <p className="text-xs text-subtle">Absent</p>
          <p className="text-sm font-medium text-fg">{attendance.absent}</p>
        </div>
      </div>
    </Card>
  );
};
