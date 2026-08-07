import { useEffect, useState } from 'react';
import { ClipboardCheck } from 'lucide-react';

import { useExamTerms, useCourseExamMarks, useUpsertCourseExamMarks } from '../../../features/examMarks/useExamMarks.js';
import { ApiError } from '../../../lib/apiError.js';
import { toast } from '../../../lib/toast.js';
import { Card } from '../../../components/ui/Card.js';
import { Button } from '../../../components/ui/Button.js';
import { Select } from '../../../components/ui/Select.js';
import { Input } from '../../../components/ui/Input.js';
import { Alert } from '../../../components/ui/Alert.js';
import { Skeleton } from '../../../components/ui/Skeleton.js';
import { EmptyState } from '../../../components/ui/EmptyState.js';
import { Table, TableHead, TableBody, TableRow, TableHeadCell, TableCell } from '../../../components/ui/Table.js';
import { ExamTermManager } from './ExamTermManager.js';

interface ExamMarksEntrySectionProps {
  courseId: string;
  isAdmin: boolean;
}

type Draft = Record<string, { marksObtained: string; maxMarks: string }>;

export const ExamMarksEntrySection = ({ courseId, isAdmin }: ExamMarksEntrySectionProps) => {
  const { data: terms, isLoading: termsLoading } = useExamTerms();
  const [examTermId, setExamTermId] = useState('');

  useEffect(() => {
    if (!examTermId && terms && terms.length > 0) setExamTermId(terms[0]!.id);
  }, [terms, examTermId]);

  const { data: rows, isLoading: rowsLoading } = useCourseExamMarks(courseId, examTermId);
  const upsert = useUpsertCourseExamMarks(courseId, examTermId);
  const [draft, setDraft] = useState<Draft>({});

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
          description={isAdmin ? 'Create one above before entering marks.' : 'Ask an admin to create an exam term (e.g. First Terminal) before you can enter marks.'}
        />
      ) : (
        <>
          <div className="max-w-xs">
            <Select
              value={examTermId}
              onValueChange={setExamTermId}
              options={terms.map((t) => ({ value: t.id, label: t.name }))}
              placeholder="Select an exam term"
            />
          </div>

          {upsert.error instanceof ApiError ? <Alert>{upsert.error.message}</Alert> : null}

          {rowsLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : !rows || rows.length === 0 ? (
            <EmptyState
              icon={ClipboardCheck}
              title="No students enrolled yet"
              description="Marks can be entered once students are enrolled in this course."
            />
          ) : (
            <Card padding="sm">
              <Table>
                <TableHead>
                  <TableRow>
                    <TableHeadCell>Student</TableHeadCell>
                    <TableHeadCell>Marks obtained</TableHeadCell>
                    <TableHeadCell>Max marks</TableHeadCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.studentId}>
                      <TableCell className="font-medium">{row.studentName}</TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min={0}
                          className="w-24"
                          value={draft[row.studentId]?.marksObtained ?? ''}
                          onChange={(e) => setField(row.studentId, 'marksObtained', e.target.value)}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min={1}
                          className="w-24"
                          value={draft[row.studentId]?.maxMarks ?? ''}
                          onChange={(e) => setField(row.studentId, 'maxMarks', e.target.value)}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="mt-4 flex justify-end px-1">
                <Button onClick={onSave} loading={upsert.isPending}>
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
