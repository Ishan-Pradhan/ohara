import { useState, useEffect } from 'react';
import { useBulkExamMarks, useSaveBulkExamMarks } from '../../../features/examMarks/useExamMarks.js';
import { Card } from '../../../components/ui/Card.js';
import { Button } from '../../../components/ui/Button.js';
import { Table, TableHead, TableBody, TableRow, TableHeadCell, TableCell } from '../../../components/ui/Table.js';
import { toast } from '../../../lib/toast.js';

interface BulkExamMarksEntryProps {
  classId: string;
  batchId: string;
  examTermId: string;
}

export const BulkExamMarksEntry = ({ classId, batchId, examTermId }: BulkExamMarksEntryProps) => {
  const { data, isLoading } = useBulkExamMarks(classId, batchId, examTermId);
  const saveMutation = useSaveBulkExamMarks(classId, batchId, examTermId);

  // Local state for the grid: key = `${studentId}_${courseId}` -> { marksObtained, maxMarks }
  const [gridState, setGridState] = useState<
    Record<string, { marksObtained: string; maxMarks: string }>
  >({});

  useEffect(() => {
    if (data?.marks) {
      const initialState: Record<string, { marksObtained: string; maxMarks: string }> = {};
      
      // Populate existing marks
      data.marks.forEach((m) => {
        initialState[`${m.studentId}_${m.courseId}`] = {
          marksObtained: m.marksObtained.toString(),
          maxMarks: m.maxMarks.toString(),
        };
      });

      // For student/course combinations without marks, default maxMarks to 100
      data.students.forEach((student) => {
        data.courses.forEach((course) => {
          const key = `${student.id}_${course.id}`;
          if (!initialState[key]) {
            initialState[key] = {
              marksObtained: '',
              maxMarks: '100',
            };
          }
        });
      });

      setGridState(initialState);
    }
  }, [data]);

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
      [key]: {
        ...prev[key]!,
        marksObtained: value,
      },
    }));
  };

  const handleMaxMarksChange = (studentId: string, courseId: string, value: string) => {
    const key = `${studentId}_${courseId}`;
    setGridState((prev) => ({
      ...prev,
      [key]: {
        ...prev[key]!,
        maxMarks: value,
      },
    }));
  };

  const handleSave = async () => {
    const payload: { studentId: string; courseId: string; marksObtained: number; maxMarks: number }[] = [];

    for (const student of data.students) {
      for (const course of data.courses) {
        const key = `${student.id}_${course.id}`;
        const cell = gridState[key];
        
        if (!cell || cell.marksObtained.trim() === '') {
          continue; // Skip empty entries
        }

        const marksObtained = Number(cell.marksObtained);
        const maxMarks = Number(cell.maxMarks);

        if (isNaN(marksObtained) || marksObtained < 0) {
          toast.error(`Invalid marks entered for ${student.name} in ${course.title}`);
          return;
        }

        if (isNaN(maxMarks) || maxMarks <= 0) {
          toast.error(`Invalid max marks entered for ${student.name} in ${course.title}`);
          return;
        }

        if (marksObtained > maxMarks) {
          toast.error(`Marks obtained cannot exceed max marks for ${student.name} in ${course.title}`);
          return;
        }

        payload.push({
          studentId: student.id,
          courseId: course.id,
          marksObtained,
          maxMarks,
        });
      }
    }

    try {
      await saveMutation.mutateAsync({
        examTermId,
        marks: payload,
      });
      toast.success('Bulk marks saved successfully!');
    } catch {
      toast.error('Failed to save bulk marks.');
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <Card padding="none" className="overflow-x-auto">
        <Table>
          <TableHead>
            <TableRow>
              <TableHeadCell className="min-w-[180px]">Student Name</TableHeadCell>
              {data.courses.map((course) => (
                <TableHeadCell key={course.id} className="text-center min-w-[140px]">
                  {course.title}
                </TableHeadCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {data.students.map((student) => (
              <TableRow key={student.id}>
                <TableCell className="font-medium text-fg">{student.name}</TableCell>
                {data.courses.map((course) => {
                  const key = `${student.id}_${course.id}`;
                  const cell = gridState[key] || { marksObtained: '', maxMarks: '100' };
                  return (
                    <TableCell key={course.id} className="p-2">
                      <div className="flex items-center justify-center gap-1.5">
                        <input
                          type="text"
                          value={cell.marksObtained}
                          onChange={(e) => handleMarksChange(student.id, course.id, e.target.value)}
                          placeholder="Marks"
                          className="w-16 rounded-control border border-border bg-surface px-2 py-1 text-center text-sm text-fg focus:border-primary focus:outline-none"
                        />
                        <span className="text-xs text-muted">/</span>
                        <input
                          type="text"
                          value={cell.maxMarks}
                          onChange={(e) => handleMaxMarksChange(student.id, course.id, e.target.value)}
                          placeholder="Max"
                          className="w-14 rounded-control border border-border bg-surface px-1.5 py-1 text-center text-xs text-muted focus:border-primary focus:outline-none"
                        />
                      </div>
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <div className="flex justify-end">
        <Button
          onClick={handleSave}
          disabled={saveMutation.isPending}
          variant="primary"
          id="save-bulk-marks-btn"
        >
          {saveMutation.isPending ? 'Saving Marks...' : 'Save All Marks'}
        </Button>
      </div>
    </div>
  );
};
