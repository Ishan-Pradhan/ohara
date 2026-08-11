import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ChevronLeft, Sparkles, Users } from 'lucide-react';

import { useAssignment, useGradeAllSubmissions, useSubmissions } from '../../../features/assignments/useAssignments.js';
import type { Submission } from '../../../features/assignments/assignments.schema.js';
import { useCurrentUser } from '../../../features/auth/useAuth.js';
import { ApiError } from '../../../lib/apiError.js';
import { toast } from '../../../lib/toast.js';
import { AppShell } from '../../../components/layout/AppShell.js';
import { PageHeader } from '../../../components/layout/PageHeader.js';
import { Badge } from '../../../components/ui/Badge.js';
import { Button } from '../../../components/ui/Button.js';
import { Skeleton } from '../../../components/ui/Skeleton.js';
import { EmptyState } from '../../../components/ui/EmptyState.js';
import { Table, TableHead, TableBody, TableRow, TableHeadCell, TableCell } from '../../../components/ui/Table.js';
import { GradeDialog } from './GradeDialog.js';

const gradeBadge = (submission: Submission): { variant: 'neutral' | 'warning' | 'success'; label: string } => {
  if (!submission.grade) return { variant: 'neutral', label: 'Ungraded' };
  if (submission.grade.status === 'approved') return { variant: 'success', label: `${submission.grade.score} pts` };
  return { variant: 'warning', label: 'Draft' };
};

export const AssignmentDetailPage = () => {
  const { courseId = '', assignmentId = '' } = useParams();
  const { data: currentUser } = useCurrentUser();
  const coursePath = currentUser?.role === 'teacher' ? `/teacher/courses/${courseId}/assignments` : `/admin/courses/${courseId}`;
  const { data: assignment, isLoading: assignmentLoading } = useAssignment(courseId, assignmentId);
  const { data: submissions, isLoading: submissionsLoading } = useSubmissions(courseId, assignmentId);
  const gradeAll = useGradeAllSubmissions(courseId, assignmentId);

  const [gradingId, setGradingId] = useState<string | null>(null);
  const gradingSubmission = submissions?.find((s) => s.id === gradingId) ?? null;

  const onGradeAll = async () => {
    try {
      const result = await gradeAll.mutateAsync();
      toast.success(`Graded ${result.graded} of ${result.total}${result.failed ? ` (${result.failed} failed)` : ''}`);
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : 'Batch grading failed');
    }
  };

  const ungradedCount = submissions?.filter((s) => !s.grade).length ?? 0;

  return (
    <AppShell>
      <Link
        to={coursePath}
        className="mb-1 flex items-center gap-1 text-sm text-muted hover:text-fg"
      >
        <ChevronLeft className="size-3.5" aria-hidden />
        {currentUser?.role === 'teacher' ? 'Assignments' : 'Course content'}
      </Link>

      {assignmentLoading ? (
        <Skeleton className="h-10 w-64" />
      ) : (
        <PageHeader
          title={assignment?.title ?? 'Assignment'}
          description={assignment ? `Due ${new Date(assignment.dueAt).toLocaleString()}` : undefined}
          actions={
            <Button
              size="sm"
              variant="secondary"
              loading={gradeAll.isPending}
              disabled={ungradedCount === 0}
              onClick={onGradeAll}
            >
              <Sparkles className="size-4" aria-hidden />
              Grade all ({ungradedCount} ungraded)
            </Button>
          }
        />
      )}

      {submissionsLoading ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : !submissions || submissions.length === 0 ? (
        <EmptyState icon={Users} title="No submissions yet" description="Nothing to grade until a student submits." />
      ) : (
        <Table>
          <TableHead>
            <TableRow>
              <TableHeadCell>Student</TableHeadCell>
              <TableHeadCell>Submitted</TableHeadCell>
              <TableHeadCell>Status</TableHeadCell>
              <TableHeadCell />
            </TableRow>
          </TableHead>
          <TableBody>
            {submissions.map((submission) => {
              const badge = gradeBadge(submission);
              return (
                <TableRow key={submission.id}>
                  <TableCell>{submission.student?.name ?? submission.studentId}</TableCell>
                  <TableCell>
                    {new Date(submission.submittedAt).toLocaleString()}
                    {submission.isLate ? <Badge variant="danger" className="ml-2">Late</Badge> : null}
                  </TableCell>
                  <TableCell>
                    <Badge variant={badge.variant}>{badge.label}</Badge>
                  </TableCell>
                  <TableCell>
                    <Button size="sm" variant="secondary" onClick={() => setGradingId(submission.id)}>
                      Review
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}

      {assignment ? (
        <GradeDialog
          courseId={courseId}
          assignmentId={assignmentId}
          assignment={assignment}
          submission={gradingSubmission}
          open={Boolean(gradingId)}
          onOpenChange={(open) => !open && setGradingId(null)}
        />
      ) : null}
    </AppShell>
  );
};
