import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ChevronLeft, Paperclip } from 'lucide-react';

import { useAssignment, useMySubmission, useSubmitAssignment } from '../../features/assignments/useAssignments.js';
import { ApiError } from '../../lib/apiError.js';
import { toast } from '../../lib/toast.js';
import { AppShell } from '../../components/layout/AppShell.js';
import { PageHeader } from '../../components/layout/PageHeader.js';
import { Badge } from '../../components/ui/Badge.js';
import { Button } from '../../components/ui/Button.js';
import { Card } from '../../components/ui/Card.js';
import { Textarea } from '../../components/ui/Textarea.js';
import { Skeleton } from '../../components/ui/Skeleton.js';
import { Alert } from '../../components/ui/Alert.js';

const scoreBadgeVariant = (score: number, maxScore: number): 'success' | 'accent' | 'danger' => {
  if (maxScore <= 0) return 'success';
  const pct = (score / maxScore) * 100;
  if (pct >= 80) return 'success';
  if (pct >= 60) return 'accent';
  return 'danger';
};

const ACCEPTED_FILE_TYPES =
  'application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,image/png,image/jpeg';

export const StudentAssignmentDetailPage = () => {
  const { courseId = '', assignmentId = '' } = useParams();
  const { data: assignment, isLoading } = useAssignment(courseId, assignmentId);
  const { data: submission } = useMySubmission(courseId, assignmentId);
  const submit = useSubmitAssignment(courseId, assignmentId);

  const [content, setContent] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setContent(submission?.content ?? '');
  }, [submission?.content]);

  const isApproved = submission?.grade?.status === 'approved';
  const totalPoints = assignment?.rubric.reduce((sum, c) => sum + c.maxPoints, 0) ?? 0;
  const isPastDue = assignment ? Date.now() > new Date(assignment.dueAt).getTime() : false;

  const onSubmit = async () => {
    if (!content.trim() && !file) {
      toast.error('Add some text or attach a file first');
      return;
    }
    try {
      await submit.mutateAsync({ content: content.trim() || undefined, file: file ?? undefined });
      toast.success(submission ? 'Resubmitted' : 'Submitted');
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : 'Submission failed');
    }
  };

  return (
    <AppShell>
      <Link
        to={`/student/courses/${courseId}`}
        className="mb-1 flex items-center gap-1 text-sm text-muted hover:text-fg"
      >
        <ChevronLeft className="size-3.5" aria-hidden />
        Back to course
      </Link>

      {isLoading || !assignment ? (
        <Skeleton className="h-10 w-64" />
      ) : (
        <PageHeader
          title={assignment.title}
          description={`Due ${new Date(assignment.dueAt).toLocaleString()} · ${totalPoints} points`}
          actions={isPastDue ? <Badge variant="danger">Past due</Badge> : undefined}
        />
      )}

      {assignment ? (
        <div className="flex flex-col gap-6">
          <Card>
            <h2 className="mb-2 text-sm font-semibold text-fg">Prompt</h2>
            <p className="whitespace-pre-wrap text-sm text-fg">{assignment.prompt}</p>

            <h2 className="mb-2 mt-4 text-sm font-semibold text-fg">Rubric</h2>
            <div className="flex flex-col gap-2">
              {assignment.rubric.map((criterion) => (
                <div key={criterion.criterion} className="flex items-start justify-between gap-3 text-sm">
                  <div>
                    <p className="font-medium text-fg">{criterion.criterion}</p>
                    {criterion.description ? <p className="text-muted">{criterion.description}</p> : null}
                  </div>
                  <span className="shrink-0 text-muted">{criterion.maxPoints} pts</span>
                </div>
              ))}
            </div>
          </Card>

          {submission?.grade ? (
            <Card
              className={
                scoreBadgeVariant(submission.grade.score, totalPoints) === 'success'
                  ? 'border-success/30'
                  : scoreBadgeVariant(submission.grade.score, totalPoints) === 'danger'
                    ? 'border-danger/30'
                    : 'border-accent/30'
              }
            >
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-fg">Grade</h2>
                <Badge variant={scoreBadgeVariant(submission.grade.score, totalPoints)}>
                  {submission.grade.score} / {totalPoints}
                </Badge>
              </div>
              <div className="flex flex-col gap-3">
                {submission.grade.criterionFeedback.map((c) => (
                  <div key={c.criterion} className="text-sm">
                    <p className="font-medium text-fg">
                      {c.criterion} — {c.awardedPoints} / {c.maxPoints}
                    </p>
                    <p className="text-muted">{c.feedback}</p>
                  </div>
                ))}
                {submission.grade.overallFeedback ? (
                  <p className="border-t border-border pt-3 text-sm text-fg">{submission.grade.overallFeedback}</p>
                ) : null}
              </div>
            </Card>
          ) : null}

          <Card
            className={!submission ? (isPastDue ? 'border-danger/30' : 'border-primary/25') : undefined}
          >
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-fg">
              {isApproved ? 'Your submission' : submission ? 'Update your submission' : 'Submit'}
              {!submission ? <Badge variant={isPastDue ? 'danger' : 'primary'}>Action needed</Badge> : null}
            </h2>

            {submit.error instanceof ApiError ? (
              <div className="mb-3">
                <Alert>{submit.error.message}</Alert>
              </div>
            ) : null}

            {isApproved ? (
              <div>
                {submission?.content ? (
                  <p className="whitespace-pre-wrap text-sm text-fg">{submission.content}</p>
                ) : null}
                {submission?.fileUrl ? (
                  <a
                    href={submission.fileUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
                  >
                    <Paperclip className="size-3.5" aria-hidden />
                    {submission.fileOriginalName ?? 'Attached file'}
                  </a>
                ) : null}
                <p className="mt-3 text-xs text-subtle">This submission has been graded and can no longer be edited.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <Textarea
                  rows={6}
                  placeholder="Write your answer…"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                />
                <div className="flex items-center gap-3">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept={ACCEPTED_FILE_TYPES}
                    className="hidden"
                    onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  />
                  <Button type="button" size="sm" variant="secondary" onClick={() => fileInputRef.current?.click()}>
                    <Paperclip className="size-4" aria-hidden />
                    {file ? file.name : submission?.fileOriginalName ? 'Replace file' : 'Attach file'}
                  </Button>
                  {submission?.fileOriginalName && !file ? (
                    <span className="text-xs text-subtle">Currently: {submission.fileOriginalName}</span>
                  ) : null}
                </div>
                <p className="text-xs text-subtle">PDF, DOCX, XLSX, PNG or JPG.</p>
                <Button className="self-start" loading={submit.isPending} onClick={onSubmit}>
                  {submission ? 'Resubmit' : 'Submit'}
                </Button>
              </div>
            )}
          </Card>
        </div>
      ) : null}
    </AppShell>
  );
};
