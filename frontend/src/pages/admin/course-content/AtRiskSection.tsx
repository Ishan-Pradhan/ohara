import { Fragment, useState } from 'react';
import { AlertTriangle, Sparkles } from 'lucide-react';

import { useAtRiskDashboard, useExplainAtRisk } from '../../../features/atRisk/useAtRisk.js';
import { toast } from '../../../lib/toast.js';
import { Card } from '../../../components/ui/Card.js';
import { Badge } from '../../../components/ui/Badge.js';
import { Button } from '../../../components/ui/Button.js';
import { Skeleton } from '../../../components/ui/Skeleton.js';
import { EmptyState } from '../../../components/ui/EmptyState.js';
import { Table, TableHead, TableBody, TableRow, TableHeadCell, TableCell } from '../../../components/ui/Table.js';

interface AtRiskSectionProps {
  courseId: string;
}

const fmtPct = (value: number | null) => (value === null ? '—' : `${value.toFixed(0)}%`);

export const AtRiskSection = ({ courseId }: AtRiskSectionProps) => {
  const { data: rows, isLoading } = useAtRiskDashboard(courseId);
  const explainAtRisk = useExplainAtRisk(courseId);
  const [explanations, setExplanations] = useState<Record<string, string>>({});
  const [explaining, setExplaining] = useState<string | null>(null);

  const onExplain = async (studentId: string) => {
    setExplaining(studentId);
    try {
      const explanation = await explainAtRisk.mutateAsync(studentId);
      setExplanations((prev) => ({ ...prev, [studentId]: explanation }));
    } catch {
      toast.error('Could not generate an explanation');
    } finally {
      setExplaining(null);
    }
  };

  if (isLoading) {
    return <Skeleton className="h-48 w-full" />;
  }

  if (!rows || rows.length === 0) {
    return (
      <EmptyState
        icon={AlertTriangle}
        title="No students enrolled yet"
        description="At-risk flags appear here once students are enrolled and have some activity."
      />
    );
  }

  const flaggedCount = rows.filter((r) => r.isAtRisk).length;

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted">
        {flaggedCount === 0
          ? 'No students are currently flagged at-risk.'
          : `${flaggedCount} student${flaggedCount === 1 ? '' : 's'} flagged at-risk.`}
      </p>

      <Card padding="sm">
        <Table>
          <TableHead>
            <TableRow>
              <TableHeadCell>Student</TableHeadCell>
              <TableHeadCell>Average grade</TableHeadCell>
              <TableHeadCell>Attendance</TableHeadCell>
              <TableHeadCell>Missing</TableHeadCell>
              <TableHeadCell>Late</TableHeadCell>
              <TableHeadCell>Status</TableHeadCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((row) => (
              <Fragment key={row.studentId}>
                <TableRow>
                  <TableCell className="font-medium">{row.studentName}</TableCell>
                  <TableCell>{fmtPct(row.averageGrade)}</TableCell>
                  <TableCell>{fmtPct(row.attendancePercentage)}</TableCell>
                  <TableCell>{row.missingSubmissions}</TableCell>
                  <TableCell>{row.lateSubmissions}</TableCell>
                  <TableCell>
                    {row.isAtRisk ? (
                      <div className="flex items-center gap-2">
                        <Badge variant="danger" className="gap-1">
                          <AlertTriangle className="size-3" aria-hidden />
                          At risk
                        </Badge>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onExplain(row.studentId)}
                          loading={explaining === row.studentId}
                        >
                          <Sparkles className="size-3.5" aria-hidden />
                          Explain
                        </Button>
                      </div>
                    ) : (
                      <Badge variant="success">On track</Badge>
                    )}
                  </TableCell>
                </TableRow>
                {explanations[row.studentId] ? (
                  <TableRow>
                    <TableCell colSpan={6} className="bg-surface-hover/50 text-sm text-muted">
                      {explanations[row.studentId]}
                    </TableCell>
                  </TableRow>
                ) : null}
              </Fragment>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
};
