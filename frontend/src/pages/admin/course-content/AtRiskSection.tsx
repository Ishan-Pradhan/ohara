import { Fragment, useMemo, useState } from 'react';
import { AlertTriangle, Lightbulb, Search, Sparkles, ArrowUpDown, TrendingDown, Clock, XCircle } from 'lucide-react';

import { useAtRiskDashboard, useExplainAtRisk } from '../../../features/atRisk/useAtRisk.js';
import { toast } from '../../../lib/toast.js';
import { Card } from '../../../components/ui/Card.js';
import { Badge } from '../../../components/ui/Badge.js';
import { Button } from '../../../components/ui/Button.js';
import { Input } from '../../../components/ui/Input.js';
import { Skeleton } from '../../../components/ui/Skeleton.js';
import { EmptyState } from '../../../components/ui/EmptyState.js';
import { Table, TableHead, TableBody, TableRow, TableHeadCell, TableCell } from '../../../components/ui/Table.js';

interface AtRiskSectionProps {
  courseId: string;
  sectionId?: string;
  /** Set when viewing a specific past batch's metrics (completed-course
   * history) instead of the course's current batch. */
  batchId?: string;
}

type SortKey = 'name' | 'averageGrade' | 'attendancePercentage' | 'missingSubmissions' | 'lateSubmissions';
type SortDir = 'asc' | 'desc';

const pctColor = (value: number | null, threshold = 60) => {
  if (value === null) return 'text-muted';
  if (value >= 80) return 'text-success';
  if (value >= threshold) return 'text-accent-fg';
  return 'text-danger';
};

const fmtPct = (value: number | null) => (value === null ? '—' : `${value.toFixed(0)}%`);

const StatTile = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-card border border-border bg-surface px-3 py-2">
    <p className="text-xs text-subtle">{label}</p>
    <p className="mt-1 text-sm font-semibold text-fg">{value}</p>
  </div>
);

export const AtRiskSection = ({ courseId, sectionId, batchId }: AtRiskSectionProps) => {
  const { data: rows, isLoading } = useAtRiskDashboard(courseId, sectionId, batchId);
  const explainAtRisk = useExplainAtRisk(courseId, batchId);
  const [explanations, setExplanations] = useState<Record<string, string>>({});
  const [explaining, setExplaining] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

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

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir(key === 'name' ? 'asc' : 'asc');
    }
  };

  const sorted = useMemo(() => {
    if (!rows) return [];
    const filtered = search.trim()
      ? rows.filter((r) => r.studentName.toLowerCase().includes(search.toLowerCase().trim()))
      : rows;

    return [...filtered].sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case 'name':
          cmp = a.studentName.localeCompare(b.studentName);
          break;
        case 'averageGrade':
          cmp = (a.averageGrade ?? -1) - (b.averageGrade ?? -1);
          break;
        case 'attendancePercentage':
          cmp = (a.attendancePercentage ?? -1) - (b.attendancePercentage ?? -1);
          break;
        case 'missingSubmissions':
          cmp = a.missingSubmissions - b.missingSubmissions;
          break;
        case 'lateSubmissions':
          cmp = a.lateSubmissions - b.lateSubmissions;
          break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [rows, search, sortKey, sortDir]);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-2">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    );
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
  const grades = rows.map((r) => r.averageGrade).filter((g): g is number => g !== null);
  const classAverage = grades.length > 0 ? grades.reduce((a, b) => a + b, 0) / grades.length : null;

  const SortHeader = ({ label, field }: { label: string; field: SortKey }) => (
    <TableHeadCell className="cursor-pointer select-none hover:text-fg transition-colors" onClick={() => toggleSort(field)}>
      <span className="inline-flex items-center gap-1">
        {label}
        <ArrowUpDown className={`size-3 ${sortKey === field ? 'text-fg' : 'text-muted/50'}`} />
      </span>
    </TableHeadCell>
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="Flagged at-risk" value={String(flaggedCount)} />
        <StatTile label="Class average" value={classAverage === null ? '—' : `${classAverage.toFixed(1)}%`} />
        <StatTile label="Students" value={String(rows.length)} />
        <StatTile
          label="Missing work"
          value={String(rows.filter((r) => r.missingSubmissions > 2).length)}
        />
      </div>

      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-muted">
          {flaggedCount === 0
            ? 'No students are currently flagged at-risk.'
            : `${flaggedCount} student${flaggedCount === 1 ? '' : 's'} flagged at-risk.`}
        </p>
        <div className="relative max-w-xs w-full">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-subtle" />
          <Input
            placeholder="Search students…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); }}
            className="pl-8"
          />
        </div>
      </div>

      <Card padding="sm">
        <Table>
          <TableHead>
            <TableRow>
              <SortHeader label="Student" field="name" />
              <SortHeader label="Avg Grade" field="averageGrade" />
              <SortHeader label="Attendance" field="attendancePercentage" />
              <SortHeader label="Missing" field="missingSubmissions" />
              <SortHeader label="Late" field="lateSubmissions" />
              <TableHeadCell>Risk Factors</TableHeadCell>
              <TableHeadCell>Status</TableHeadCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {sorted.map((row) => (
              <Fragment key={row.studentId}>
                <TableRow className={row.isAtRisk ? 'bg-danger/5' : ''}>
                  <TableCell className="font-medium">{row.studentName}</TableCell>
                  <TableCell>
                    <span className={pctColor(row.averageGrade)}>
                      {fmtPct(row.averageGrade)}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className={pctColor(row.attendancePercentage)}>
                      {fmtPct(row.attendancePercentage)}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className={row.missingSubmissions > 0 ? 'text-danger font-medium' : 'text-subtle'}>
                      {row.missingSubmissions}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className={row.lateSubmissions > 0 ? 'text-accent-fg font-medium' : 'text-subtle'}>
                      {row.lateSubmissions}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {row.averageGrade !== null && row.averageGrade < 50 && (
                        <Badge variant="danger" className="gap-1 text-xs">
                          <TrendingDown className="size-2.5" /> Low grade
                        </Badge>
                      )}
                      {row.attendancePercentage !== null && row.attendancePercentage < 60 && (
                        <Badge variant="danger" className="gap-1 text-xs">
                          <XCircle className="size-2.5" /> Poor attendance
                        </Badge>
                      )}
                      {row.missingSubmissions > 2 && (
                        <Badge variant="warning" className="gap-1 text-xs">
                          <Clock className="size-2.5" /> Missing work
                        </Badge>
                      )}
                      {row.lateSubmissions > 2 && (
                        <Badge variant="warning" className="gap-1 text-xs">
                          <Clock className="size-2.5" /> Late work
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {row.isAtRisk ? (
                      <div className="flex items-center gap-2">
                        <Badge variant="danger" className="gap-1">
                          <AlertTriangle className="size-3" />
                          At risk
                        </Badge>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onExplain(row.studentId)}
                          loading={explaining === row.studentId}
                        >
                          <Sparkles className="size-3.5" />
                          Explain
                        </Button>
                      </div>
                    ) : (
                      <Badge variant="success">On track</Badge>
                    )}
                  </TableCell>
                </TableRow>
                {explanations[row.studentId] ? (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={7} className="bg-transparent py-3">
                      <div className="flex items-start gap-2 rounded-card border border-primary/20 bg-primary/5 p-3">
                        <Lightbulb className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                        <p className="text-sm leading-relaxed text-fg">{explanations[row.studentId]}</p>
                      </div>
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
