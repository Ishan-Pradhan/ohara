import { useEffect, useMemo, useState } from 'react';
import { Search, Save } from 'lucide-react';

import { useBulkExamMarks, useSaveBulkExamMarks } from '../../../features/examMarks/useExamMarks.js';
import { Card } from '../../../components/ui/Card.js';
import { Button } from '../../../components/ui/Button.js';
import { Input } from '../../../components/ui/Input.js';
import { toast } from '../../../lib/toast.js';

interface BulkExamMarksEntryProps {
  classId: string;
  batchId: string;
  examTermId: string;
  sectionId?: string;
}

export const BulkExamMarksEntry = ({ classId, batchId, examTermId, sectionId }: BulkExamMarksEntryProps) => {
  const { data, isLoading } = useBulkExamMarks(classId, batchId, examTermId, sectionId);
  const saveMutation = useSaveBulkExamMarks(classId, batchId, examTermId, sectionId);

  const [gridState, setGridState] = useState<
    Record<string, { marksObtained: string; maxMarks: string }>
  >({});
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (data?.marks) {
      const initialState: Record<string, { marksObtained: string; maxMarks: string }> = {};

      data.marks.forEach((m) => {
        initialState[`${m.studentId}_${m.courseId}`] = {
          marksObtained: m.marksObtained.toString(),
          maxMarks: m.maxMarks.toString(),
        };
      });

      data.students.forEach((student) => {
        data.courses.forEach((course) => {
          const key = `${student.id}_${course.id}`;
          if (!initialState[key]) {
            initialState[key] = { marksObtained: '', maxMarks: '100' };
          }
        });
      });

      setGridState(initialState);
    }
  }, [data]);

  const filteredStudents = useMemo(() => {
    if (!data) return [];
    const q = search.toLowerCase().trim();
    return q
      ? data.students.filter((s) => s.name.toLowerCase().includes(q))
      : data.students;
  }, [data, search]);

  if (isLoading) {
    return (
      <div className="flex h-32 items-center justify-center">
        <p className="text-sm text-muted">Loading roster and courses...</p>
      </div>
    );
  }

  if (!data || data.students.length === 0) {
    return (
      <Card padding="md" className="text-center">
        <p className="text-sm text-muted">No students found for the selected batch and semester.</p>
      </Card>
    );
  }

  if (data.courses.length === 0) {
    return (
      <Card padding="md" className="text-center">
        <p className="text-sm text-muted">No courses/subjects found for the selected semester.</p>
      </Card>
    );
  }

  const handleMarksChange = (studentId: string, courseId: string, value: string) => {
    const key = `${studentId}_${courseId}`;
    setGridState((prev) => ({
      ...prev,
      [key]: { ...prev[key]!, marksObtained: value },
    }));
  };

  const handleMaxMarksChange = (studentId: string, courseId: string, value: string) => {
    const key = `${studentId}_${courseId}`;
    setGridState((prev) => ({
      ...prev,
      [key]: { ...prev[key]!, maxMarks: value },
    }));
  };

  const handleSave = async () => {
    const payload: { studentId: string; courseId: string; marksObtained: number; maxMarks: number }[] = [];

    for (const student of data.students) {
      for (const course of data.courses) {
        const key = `${student.id}_${course.id}`;
        const cell = gridState[key];

        if (!cell || cell.marksObtained.trim() === '') continue;

        const marksObtained = Number(cell.marksObtained);
        const maxMarks = Number(cell.maxMarks);

        if (isNaN(marksObtained) || marksObtained < 0) {
          toast.error(`Invalid marks for ${student.name} in ${course.title}`);
          return;
        }
        if (isNaN(maxMarks) || maxMarks <= 0) {
          toast.error(`Invalid max marks for ${student.name} in ${course.title}`);
          return;
        }
        if (marksObtained > maxMarks) {
          toast.error(`Marks exceed max for ${student.name} in ${course.title}`);
          return;
        }

        payload.push({ studentId: student.id, courseId: course.id, marksObtained, maxMarks });
      }
    }

    try {
      await saveMutation.mutateAsync({ examTermId, marks: payload });
      toast.success('Marks saved successfully!');
    } catch {
      toast.error('Failed to save marks.');
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <div className="relative max-w-xs">
          <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-subtle" />
          <Input
            placeholder="Search students…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 pl-8 text-sm"
          />
        </div>
        <span className="text-xs text-muted">
          {filteredStudents.length} student{filteredStudents.length !== 1 ? 's' : ''} · {data.courses.length} course{data.courses.length !== 1 ? 's' : ''}
        </span>
      </div>

      <Card padding="none" className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border bg-surface-hover">
              <th className="sticky left-0 z-10 min-w-[180px] bg-surface-hover px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-subtle">
                Student
              </th>
              {data.courses.map((course) => (
                <th
                  key={course.id}
                  className="min-w-[140px] px-4 py-2.5 text-center text-xs font-semibold uppercase tracking-wide text-subtle"
                >
                  {course.title}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filteredStudents.map((student) => (
              <tr key={student.id} className="transition-colors hover:bg-surface-hover/60">
                <td className="sticky left-0 z-10 bg-surface px-4 py-2.5 font-medium text-fg">
                  {student.name}
                </td>
                {data.courses.map((course) => {
                  const key = `${student.id}_${course.id}`;
                  const cell = gridState[key] || { marksObtained: '', maxMarks: '100' };
                  return (
                    <td key={course.id} className="px-4 py-2">
                      <div className="flex items-center justify-center gap-1">
                        <input
                          type="text"
                          value={cell.marksObtained}
                          onChange={(e) => handleMarksChange(student.id, course.id, e.target.value)}
                          placeholder="—"
                          className="w-14 rounded-control border border-border bg-surface px-2 py-1 text-center text-sm text-fg transition-colors focus:border-primary focus:outline-none"
                        />
                        <span className="text-xs text-muted">/</span>
                        <input
                          type="text"
                          value={cell.maxMarks}
                          onChange={(e) => handleMaxMarksChange(student.id, course.id, e.target.value)}
                          className="w-12 rounded-control border border-border bg-surface px-1.5 py-1 text-center text-xs text-muted transition-colors focus:border-primary focus:outline-none"
                        />
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
            {filteredStudents.length === 0 ? (
              <tr>
                <td
                  colSpan={data.courses.length + 1}
                  className="px-4 py-8 text-center text-sm text-muted"
                >
                  No students match "{search}"
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </Card>

      <div className="flex items-center justify-between">
        <p className="text-xs text-muted">
          Only filled cells will be saved. Empty cells are ignored.
        </p>
        <Button onClick={handleSave} disabled={saveMutation.isPending}>
          <Save className="size-4" aria-hidden />
          {saveMutation.isPending ? 'Saving…' : 'Save All Marks'}
        </Button>
      </div>
    </div>
  );
};
