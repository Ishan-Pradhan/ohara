import { RotateCw, Sparkles } from 'lucide-react';

import { useSummary, useGenerateSummary } from '../../features/studyAids/useStudyAids.js';
import { ApiError } from '../../lib/apiError.js';
import { toast } from '../../lib/toast.js';
import { Card } from '../ui/Card.js';
import { Button } from '../ui/Button.js';
import { Skeleton } from '../ui/Skeleton.js';
import { EmptyState } from '../ui/EmptyState.js';

interface SummarySectionProps {
  courseId: string;
  lessonId?: string;
}

export const SummarySection = ({ courseId, lessonId }: SummarySectionProps) => {
  const { data: summary, isLoading } = useSummary(courseId, lessonId);
  const generate = useGenerateSummary(courseId, lessonId);

  if (isLoading) {
    return (
      <Card padding="sm">
        <Skeleton className="mb-3 h-5 w-40" />
        <Skeleton className="h-24 w-full" />
      </Card>
    );
  }

  if (!summary) {
    return (
      <Card padding="sm">
        <EmptyState
          icon={Sparkles}
          title="No summary yet"
          description={
            lessonId
              ? "Generate an AI summary of this lesson's material."
              : "Generate an AI summary of this course's material."
          }
          action={
            <Button size="sm" loading={generate.isPending} onClick={() => generate.mutate(undefined)}>
              <Sparkles className="size-4" aria-hidden />
              Generate summary
            </Button>
          }
        />
        {generate.isError ? (
          <p className="mt-3 text-center text-xs text-danger">
            {generate.error instanceof ApiError
              ? generate.error.message
              : "Couldn't generate a summary — try again."}
          </p>
        ) : null}
      </Card>
    );
  }

  const onRegenerate = async () => {
    try {
      await generate.mutateAsync(true);
      toast.success('Summary regenerated');
    } catch {
      toast.error("Couldn't regenerate the summary — try again.");
    }
  };

  return (
    <Card padding="sm">
      <div className="mb-3 flex justify-end">
        <Button size="sm" variant="secondary" loading={generate.isPending} onClick={onRegenerate}>
          <RotateCw className="size-3.5" aria-hidden />
          Regenerate
        </Button>
      </div>
      <p className="text-sm leading-relaxed text-fg">{summary.content.summary}</p>
      {summary.content.keyPoints.length > 0 ? (
        <ul className="mt-4 flex flex-col gap-1.5 border-t border-border pt-4">
          {summary.content.keyPoints.map((point, i) => (
            <li key={i} className="flex gap-2 text-sm text-fg">
              <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" aria-hidden />
              {point}
            </li>
          ))}
        </ul>
      ) : null}
    </Card>
  );
};
