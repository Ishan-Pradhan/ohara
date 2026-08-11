import { useEffect, useMemo, useState } from 'react';
import { ClipboardCheck, Save, Search } from 'lucide-react';

import { useExamTerms, useCourseExamMarks, useUpsertCourseExamMarks } from '../../../features/examMarks/useExamMarks.js';
import { ApiError } from '../../../lib/apiError.js';
import { toast } from '../../../lib/toast.js';
import { Card } from '../../../components/ui/Card.js';
import { Button } from '../../../components/ui/Button.js';
import { Input } from '../../../components/ui/Input.js';
import { Select } from '../../../components/ui/Select.js';
import { Alert } from '../../../components/ui/Alert.js';
import { Skeleton } from '../../../components/ui/Skeleton.js';
import { EmptyState } from '../../../components/ui/EmptyState.js';
import { ExamTermManager } from './ExamTermManager.js';

interface ExamMarksEntrySectionProps {
  courseId: string;
  isAdmin: boolean;
  programName?: string | null;
  className?: string | null;
  batchName?: string | null;
  sectionName?: string | null;
}

type Draft = Record<string, { marksObtained: string; maxMarks: string }>;

const pctColor = (obtained: number | null, max: number | null) => {
  if (obtained === null || max === null || max === 0) return 'text-muted';
  const pct = (obtained / max) * 100;
  if (pct >= 80) return 'text-success';
  if (pct >= 60) return 'text-primary';
  if (pct >= 40) return 'text-accent-fg';
  return 'text-danger';
};

export const ExamMarksEntrySection = ({ courseId, isAdmin, programName, className, batchName, sectionName }: ExamMarksEntrySectionProps) => {
  const { data: terms, isLoading: termsLoading } = useExamTerms();
  const [examTermId, setExamTermId] = useState('');

  useEffect(() => {
    if (!examTermId && terms && terms.length > 0) setExamTermId(terms[0]!.id);
  }, [terms, examTermId]);

  const { data: rows, isLoading: rowsLoading } = useCourseExamMarks(courseId, examTermId);
  const upsert = useUpsertCourseExamMarks(courseId, examTermId);
  const [draft, setDraft] = useState<Draft>({});
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!rows) return;
    const next: Draft = {};
    for (const row of rows) {
      next[row.studentId] = {
        marksObtained: row.marksObtained === null ? '' : String(row.marksObtained),
        maxMarks: row.maxMarks === null ? '' : String(row.maxMarks),
      };
    }
    setDraft(next);
  }, [rows]);

  const filteredRows = useMemo(() => {
    if (!rows) return [];
    const q = search.toLowerCase().trim();
    return q ? rows.filter((r) => r.studentName.toLowerCase().includes(q)) : rows;
  }, [rows, search]);

  const setField = (studentId: string, key: 'marksObtained' | 'maxMarks', value: string) => {
    setDraft((prev) => ({ ...prev, [studentId]: { ...prev[studentId], [key]: value } }));
  };

  const onSave = async () => {
    if (!rows) return;
    const marks = rows
      .map((row) => {
        const entry = draft[row.studentId];
        const marksObtained = Number(entry?.marksObtained);
        const maxMarks = Number(entry?.maxMarks);
        if (!entry?.marksObtained || !entry.maxMarks || Number.isNaN(marksObtained) || Number.isNaN(maxMarks)) {
          return null;
        }
        return { studentId: row.studentId, marksObtained, maxMarks };
      })
      .filter((m): m is { studentId: string; marksObtained: number; maxMarks: number } => m !== null);

    if (marks.length === 0) {
      toast.error('Enter at least one mark before saving');
      return;
    }

    try {
      await upsert.mutateAsync(marks);
      toast.success('Marks saved');
    } catch (caught) {
      if (caught instanceof ApiError) toast.error(caught.message);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {isAdmin ? <ExamTermManager /> : null}

      {termsLoading ? (
        <Skeleton className="h-12 w-full" />
      ) : !terms || terms.length === 0 ? (
        <EmptyState
          icon={ClipboardCheck}
          title="No exam terms yet"
          description={isAdmin ? 'Create one above before entering marks.' : 'Ask an admin to create an exam term before you can enter marks.'}
        />
      ) : (
        <>
          <div className="flex items-center justify-between gap-3">
            <div className="max-w-xs">
              <Select
                value={examTermId}
                onValueChange={setExamTermId}
                options={terms.map((t) => ({ value: t.id, label: t.name }))}
                placeholder="Select an exam term"
              />
            </div>
            {rows && rows.length > 0 ? (
              <div className="relative max-w-xs">
                <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-subtle" />
                <Input
                  placeholder="Search students…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="h-9 pl-8 text-sm"
                />
              </div>
            ) : null}
          </div>

          {upsert.error instanceof ApiError ? <Alert>{upsert.error.message}</Alert> : null}

          {(programName || className || batchName || sectionName) && (
            <div className="flex flex-wrap items-center gap-2 rounded-control border border-border bg-surface-hover px-4 py-2.5 text-sm text-muted">
              {programName ? <span className="font-medium text-fg">{programName}</span> : null}
              {className ? <span>· {className}</span> : null}
              {batchName ? <span>· Batch {batchName}</span> : null}
              {sectionName ? <span>· Section {sectionName}</span> : null}
            </div>
          )}

          {rowsLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : !rows || rows.length === 0 ? (
            <EmptyState
              icon={ClipboardCheck}
              title="No students enrolled yet"
              description="Marks can be entered once students are enrolled in this course."
            />
          ) : (
            <Card padding="none" className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border bg-surface-hover">
                    <th className="px-5 py-2.5 text-xs font-semibold uppercase tracking-wide text-subtle">
                      Student
                    </th>
                    <th className="px-5 py-2.5 text-xs font-semibold uppercase tracking-wide text-subtle">
                      Marks Obtained
                    </th>
                    <th className="px-5 py-2.5 text-xs font-semibold uppercase tracking-wide text-subtle">
                      Max Marks
                    </th>
                    <th className="px-5 py-2.5 text-xs font-semibold uppercase tracking-wide text-subtle">
                      %
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredRows.map((row) => {
                    const entry = draft[row.studentId];
                    const obtained = entry?.marksObtained ? Number(entry.marksObtained) : null;
                    const max = entry?.maxMarks ? Number(entry.maxMarks) : null;
                    return (
                      <tr key={row.studentId} className="transition-colors hover:bg-surface-hover/60">
                        <td className="px-5 py-2.5 font-medium text-fg">{row.studentName}</td>
                        <td className="px-5 py-2.5">
                          <Input
                            type="number"
                            min={0}
                            className="w-24"
                            value={entry?.marksObtained ?? ''}
                            onChange={(e) => setField(row.studentId, 'marksObtained', e.target.value)}
                          />
                        </td>
                        <td className="px-5 py-2.5">
                          <Input
                            type="number"
                            min={1}
                            className="w-24"
                            value={entry?.maxMarks ?? ''}
                            onChange={(e) => setField(row.studentId, 'maxMarks', e.target.value)}
                          />
                        </td>
                        <td className="px-5 py-2.5">
                          {obtained !== null && max !== null && max > 0 ? (
                            <span className={`text-sm font-semibold ${pctColor(obtained, max)}`}>
                              {((obtained / max) * 100).toFixed(0)}%
                            </span>
                          ) : (
                            <span className="text-sm text-muted">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {filteredRows.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-5 py-8 text-center text-sm text-muted">
                        No students match "{search}"
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>

              <div className="flex items-center justify-between border-t border-border px-5 py-3">
                <p className="text-xs text-muted">
                  {filteredRows.length} student{filteredRows.length !== 1 ? 's' : ''}
                </p>
                <Button onClick={onSave} loading={upsert.isPending}>
                  <Save className="size-4" aria-hidden />
                  Save marks
                </Button>
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
};
