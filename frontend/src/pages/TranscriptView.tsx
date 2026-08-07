import { Download, GraduationCap } from 'lucide-react';

import { useReportCard } from '../features/examMarks/useExamMarks.js';
import { Card } from '../components/ui/Card.js';
import { Badge } from '../components/ui/Badge.js';
import { Skeleton } from '../components/ui/Skeleton.js';
import { EmptyState } from '../components/ui/EmptyState.js';
import { Table, TableHead, TableBody, TableRow, TableHeadCell, TableCell } from '../components/ui/Table.js';

interface TranscriptViewProps {
  studentId: string;
}

const fmtPct = (value: number | null) => (value === null ? '—' : `${value.toFixed(1)}%`);

const gradeVariant = (grade: string): 'success' | 'primary' | 'warning' | 'danger' | 'neutral' => {
  if (grade === 'A') return 'success';
  if (grade === 'B' || grade === 'C') return 'primary';
  if (grade === 'D') return 'warning';
  if (grade === 'F') return 'danger';
  return 'neutral';
};

export const TranscriptView = ({ studentId }: TranscriptViewProps) => {
  const { data: reportCard, isLoading } = useReportCard(studentId);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!reportCard) return null;

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-lg font-semibold text-fg">{reportCard.studentName}</p>
            <p className="mt-0.5 text-sm text-muted">
              {[reportCard.programName, reportCard.className, `Section ${reportCard.sectionName}`, reportCard.academicYearName]
                .filter((v) => v && v !== '—')
                .join(' · ')}
            </p>
          </div>
          <a
            href={`/api/v1/students/${studentId}/transcript/pdf`}
            download
            className="inline-flex items-center justify-center gap-2 rounded-control border border-border bg-surface px-4 py-2.5 text-sm font-medium text-fg transition-colors hover:bg-surface-hover hover:border-border-strong active:scale-[0.98]"
          >
            <Download className="size-4" aria-hidden />
            Download PDF
          </a>
        </div>

        <div className="mt-5 flex items-center gap-3 border-t border-border pt-4">
          <span className="text-sm text-muted">Overall Cumulative</span>
          <span className="text-lg font-semibold text-fg">{fmtPct(reportCard.overallPercentage)}</span>
          <Badge variant={gradeVariant(reportCard.overallGrade)}>{reportCard.overallGrade}</Badge>
        </div>
      </Card>

      {reportCard.semesters.length === 0 ? (
        <EmptyState
          icon={GraduationCap}
          title="No transcript records yet"
          description="Grades will appear here once exam marks are entered."
        />
      ) : (
        reportCard.semesters.map((sem) => (
          <Card key={sem.classId} padding="sm">
            <div className="flex items-center justify-between gap-3 px-1 pb-2">
              <h3 className="text-sm font-semibold text-fg">{sem.className}</h3>
              <span className="text-sm text-muted font-medium">
                Semester Total: {sem.totalObtained}/{sem.totalMax} ({fmtPct(sem.percentage)}) · Grade: {sem.grade}
              </span>
            </div>
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeadCell>Course</TableHeadCell>
                  {sem.examTerms.map((term) => (
                    <TableHeadCell key={term.examTermId} className="text-center">
                      {term.examTermName}
                    </TableHeadCell>
                  ))}
                  <TableHeadCell className="text-center">Total</TableHeadCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {sem.courses.map((course) => (
                  <TableRow key={course.courseId}>
                    <TableCell className="font-medium">{course.courseTitle}</TableCell>
                    {sem.examTerms.map((term) => {
                      const mark = course.marks[term.examTermId];
                      return (
                        <TableCell key={term.examTermId} className="text-center">
                          {mark ? `${mark.marksObtained}/${mark.maxMarks}` : '—'}
                        </TableCell>
                      );
                    })}
                    <TableCell className="text-center font-semibold">
                      {course.courseTotalObtained}/{course.courseTotalMax} ({fmtPct(course.coursePercentage)})
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        ))
      )}
    </div>
  );
};
