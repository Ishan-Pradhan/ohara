import { BarChart3 } from 'lucide-react';

import { useGradebook } from '../../../features/gradebook/useGradebook.js';
import type { GradebookEntry } from '../../../features/gradebook/gradebook.schema.js';
import { Badge } from '../../../components/ui/Badge.js';
import { Skeleton } from '../../../components/ui/Skeleton.js';
import { EmptyState } from '../../../components/ui/EmptyState.js';
import { Table, TableHead, TableBody, TableRow, TableHeadCell, TableCell } from '../../../components/ui/Table.js';

interface GradebookSectionProps {
  courseId: string;
}

const statusLabel: Record<GradebookEntry['status'], string> = {
  graded: '',
  pending: 'Pending review',
  ungraded: 'Ungraded',
  not_submitted: 'Not submitted',
  not_attempted: 'Not attempted',
};

const EntryCell = ({ entry }: { entry: GradebookEntry }) => {
  if (entry.status === 'graded') {
    return (
      <span className="text-fg">
        {entry.score} / {entry.maxScore}
      </span>
    );
  }
  const variant = entry.status === 'pending' ? 'warning' : 'neutral';
  return <Badge variant={variant}>{statusLabel[entry.status]}</Badge>;
};

export const GradebookSection = ({ courseId }: GradebookSectionProps) => {
  const { data: gradebook, isLoading } = useGradebook(courseId);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-2">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    );
  }

  if (!gradebook || gradebook.assessments.length === 0) {
    return (
      <EmptyState
        icon={BarChart3}
        title="Nothing to grade yet"
        description="Grades appear here once there's at least one assignment or published quiz."
      />
    );
  }

  return (
    <Table>
      <TableHead>
        <TableRow>
          <TableHeadCell>Student</TableHeadCell>
          {gradebook.assessments.map((assessment) => (
            <TableHeadCell key={assessment.id}>
              {assessment.title}
              <span className="ml-1 font-normal normal-case text-subtle">/{assessment.maxScore}</span>
            </TableHeadCell>
          ))}
          <TableHeadCell>Average</TableHeadCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {gradebook.rows.map((row) => (
          <TableRow key={row.studentId}>
            <TableCell className="font-medium">{row.studentName}</TableCell>
            {row.entries.map((entry) => (
              <TableCell key={entry.assessmentId}>
                <EntryCell entry={entry} />
              </TableCell>
            ))}
            <TableCell className="font-medium">
              {row.average === null ? <span className="text-subtle">—</span> : `${row.average.toFixed(1)}%`}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
};
