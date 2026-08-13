import { Download, GraduationCap, Award, BookOpen } from 'lucide-react';

import { useReportCard } from '../features/examMarks/useExamMarks.js';
import { Card } from '../components/ui/Card.js';
import { Badge } from '../components/ui/Badge.js';
import { ProgressRing } from '../components/ui/ProgressRing.js';
import { Skeleton } from '../components/ui/Skeleton.js';
import { EmptyState } from '../components/ui/EmptyState.js';

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

const gradeColor = (pct: number | null) => {
  if (pct === null) return 'text-muted';
  if (pct >= 80) return 'text-success';
  if (pct >= 60) return 'text-primary';
  if (pct >= 40) return 'text-accent-fg';
  return 'text-danger';
};

export const TranscriptView = ({ studentId }: TranscriptViewProps) => {
  const { data: reportCard, isLoading } = useReportCard(studentId);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!reportCard) return null;

  return (
    <div className="flex flex-col gap-6">
      {/* Header card */}
      <Card>
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex size-14 shrink-0 items-center justify-center rounded-full bg-primary-soft">
              <GraduationCap className="size-7 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-fg">{reportCard.studentName}</h2>
              <p className="mt-0.5 text-sm text-muted">
                {[reportCard.programName, reportCard.className, `Section ${reportCard.sectionName}`, reportCard.batchName]
                  .filter((v) => v && v !== '—')
                  .join(' · ')}
              </p>
            </div>
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

        {/* Overall stats */}
        <div className="mt-5 grid grid-cols-3 gap-4 border-t border-border pt-5">
          <div className="flex items-center gap-3">
            <ProgressRing
              value={reportCard.overallPercentage ?? 0}
              size={52}
              strokeWidth={5}
              label="Overall average"
            />
            <div>
              <p className="text-xs text-subtle">Overall Average</p>
              <p className={`text-lg font-bold ${gradeColor(reportCard.overallPercentage)}`}>
                {fmtPct(reportCard.overallPercentage)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-surface-hover">
              <Award className="size-5 text-accent" />
            </div>
            <div>
              <p className="text-xs text-subtle">Overall Grade</p>
              <Badge variant={gradeVariant(reportCard.overallGrade)} className="mt-0.5 text-sm">
                {reportCard.overallGrade}
              </Badge>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-surface-hover">
              <BookOpen className="size-5 text-muted" />
            </div>
            <div>
              <p className="text-xs text-subtle">Semesters</p>
              <p className="text-lg font-bold text-fg">{reportCard.semesters.length}</p>
            </div>
          </div>
        </div>
      </Card>

      {/* Semesters */}
      {reportCard.semesters.length === 0 ? (
        <EmptyState
          icon={GraduationCap}
          title="No transcript records yet"
          description="Grades will appear here once exam marks are entered."
        />
      ) : (
        reportCard.semesters.map((sem) => (
          <Card key={sem.classId} padding="none">
            {/* Semester header */}
            <div className="flex flex-col gap-2 border-b border-border px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-sm font-semibold text-fg">{sem.className}</h3>
                <p className="mt-0.5 text-xs text-subtle">
                  {[sem.batchName, sem.sectionName]
                    .filter((v) => v && v !== '—')
                    .join(' · ')}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm text-muted">
                  {sem.totalObtained}/{sem.totalMax}
                </span>
                <Badge variant={gradeVariant(sem.grade)}>{sem.grade}</Badge>
                <span className={`text-sm font-semibold ${gradeColor(sem.percentage)}`}>
                  {fmtPct(sem.percentage)}
                </span>
              </div>
            </div>

            {/* Marks table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border bg-surface-hover">
                    <th className="px-5 py-2.5 text-xs font-semibold uppercase tracking-wide text-subtle">
                      Course
                    </th>
                    {sem.examTerms.map((term) => (
                      <th
                        key={term.examTermId}
                        className="px-5 py-2.5 text-center text-xs font-semibold uppercase tracking-wide text-subtle"
                      >
                        {term.examTermName}
                      </th>
                    ))}
                    <th className="px-5 py-2.5 text-center text-xs font-semibold uppercase tracking-wide text-subtle">
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {sem.courses.map((course) => (
                    <tr key={course.courseId} className="transition-colors hover:bg-surface-hover/60">
                      <td className="px-5 py-3 font-medium text-fg">{course.courseTitle}</td>
                      {sem.examTerms.map((term) => {
                        const mark = course.marks[term.examTermId];
                        return (
                          <td key={term.examTermId} className="px-5 py-3 text-center text-fg">
                            {mark ? `${mark.marksObtained}/${mark.maxMarks}` : '—'}
                          </td>
                        );
                      })}
                      <td className="px-5 py-3 text-center">
                        <span className={`font-semibold ${gradeColor(course.coursePercentage)}`}>
                          {course.courseTotalObtained}/{course.courseTotalMax}
                        </span>
                        <span className="ml-1.5 text-xs text-muted">
                          ({fmtPct(course.coursePercentage)})
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        ))
      )}
    </div>
  );
};
