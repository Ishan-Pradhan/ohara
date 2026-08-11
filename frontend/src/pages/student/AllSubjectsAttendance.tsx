import { CalendarCheck } from 'lucide-react';

import { useStudentAttendance } from '../../features/placement/usePlacement.js';
import { Card } from '../../components/ui/Card.js';
import { Badge } from '../../components/ui/Badge.js';
import { ProgressRing } from '../../components/ui/ProgressRing.js';
import { Skeleton } from '../../components/ui/Skeleton.js';
import { EmptyState } from '../../components/ui/EmptyState.js';
import {
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableHeadCell,
  TableCell,
} from '../../components/ui/Table.js';

interface AllSubjectsAttendanceProps {
  studentId: string;
}

const pctVariant = (pct: number | null): 'success' | 'warning' | 'danger' | 'neutral' => {
  if (pct === null) return 'neutral';
  if (pct >= 80) return 'success';
  if (pct >= 60) return 'warning';
  return 'danger';
};

/** Every subject the student is taking this semester, together, so
 * "how am I doing overall" doesn't require switching between courses one
 * at a time to find out. */
export const AllSubjectsAttendance = ({ studentId }: AllSubjectsAttendanceProps) => {
  const { data: courses, isLoading, isError } = useStudentAttendance(studentId);

  if (isLoading) {
    return <Skeleton className="h-64 w-full" />;
  }

  if (isError || !courses) {
    return (
      <EmptyState
        icon={CalendarCheck}
        title="Not placed yet"
        description="Your admin hasn't placed you into a class and section for this academic year yet."
      />
    );
  }

  if (courses.length === 0) {
    return (
      <EmptyState
        icon={CalendarCheck}
        title="No courses yet"
        description="Attendance will appear here once you're enrolled in a course."
      />
    );
  }

  const totals = courses.reduce(
    (acc, c) => ({
      total: acc.total + c.total,
      present: acc.present + c.present,
      late: acc.late + c.late,
    }),
    { total: 0, present: 0, late: 0 },
  );
  const overallPct = totals.total > 0 ? ((totals.present + totals.late) / totals.total) * 100 : null;

  return (
    <div className="flex flex-col gap-4">
      <Card padding="sm">
        <div className="flex flex-wrap items-center gap-4">
          <ProgressRing value={overallPct ?? 0} size={72} strokeWidth={7} label="Overall attendance" />
          <div>
            <p className="text-xs text-subtle">Overall attendance</p>
            <p className="text-2xl font-bold text-fg">
              {overallPct === null ? '—' : `${overallPct.toFixed(0)}%`}
            </p>
            <p className="text-xs text-muted">
              {totals.total} session{totals.total === 1 ? '' : 's'} across {courses.length} subject
              {courses.length === 1 ? '' : 's'}
            </p>
          </div>
        </div>
      </Card>

      <Table>
        <TableHead>
          <TableRow>
            <TableHeadCell>Subject</TableHeadCell>
            <TableHeadCell className="text-center">Present</TableHeadCell>
            <TableHeadCell className="text-center">Late</TableHeadCell>
            <TableHeadCell className="text-center">Absent</TableHeadCell>
            <TableHeadCell className="text-center">Sessions</TableHeadCell>
            <TableHeadCell className="text-right">Attendance</TableHeadCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {courses.map((course) => (
            <TableRow key={course.courseId}>
              <TableCell className="font-medium">{course.courseTitle}</TableCell>
              <TableCell className="text-center text-muted">{course.present}</TableCell>
              <TableCell className="text-center text-muted">{course.late}</TableCell>
              <TableCell className="text-center text-muted">{course.absent}</TableCell>
              <TableCell className="text-center text-muted">{course.total}</TableCell>
              <TableCell className="text-right">
                <Badge variant={pctVariant(course.percentage)}>
                  {course.percentage === null ? '—' : `${course.percentage.toFixed(0)}%`}
                </Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};
