import { AlertCircle, CheckCircle2, HelpCircle, Microscope, Target } from 'lucide-react';

import { useMasteryReport } from '../../features/dashboard/useMastery.js';
import type { CourseMasteryReport, WeakCriterion, WeakQuestion } from '../../features/dashboard/mastery.schema.js';
import { Card } from '../../components/ui/Card.js';
import { Badge } from '../../components/ui/Badge.js';
import { Skeleton } from '../../components/ui/Skeleton.js';
import { EmptyState } from '../../components/ui/EmptyState.js';
import { cn } from '../../lib/cn.js';

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────

type OverallMastery = CourseMasteryReport['overallMastery'];

const masteryBadgeVariant = (
  state: OverallMastery,
): 'success' | 'primary' | 'danger' | 'neutral' => {
  if (state === 'strong') return 'success';
  if (state === 'developing') return 'primary';
  if (state === 'needs_attention') return 'danger';
  return 'neutral';
};

const masteryLabel = (state: OverallMastery): string => {
  if (state === 'strong') return 'Strong';
  if (state === 'developing') return 'Developing';
  if (state === 'needs_attention') return 'Needs attention';
  return 'No evidence';
};

const pct = (rate: number) => `${Math.round(rate * 100)}%`;

// ──────────────────────────────────────────────────────────────────────────────
// Sub-components
// ──────────────────────────────────────────────────────────────────────────────

const WeakQuestionRow = ({ question }: { question: WeakQuestion }) => (
  <div className="flex items-start gap-3 rounded-control bg-surface-hover px-3 py-2.5">
    <HelpCircle
      className={cn(
        'mt-0.5 size-4 shrink-0',
        question.masteryState === 'needs_attention' ? 'text-danger' : 'text-warning',
      )}
      aria-hidden
    />
    <div className="min-w-0 flex-1">
      <p className="line-clamp-2 text-sm text-fg">{question.prompt}</p>
      <p className="mt-0.5 text-xs text-muted">
        {question.correct}/{question.attempts} correct · {pct(question.correctRate)} accuracy
      </p>
    </div>
    <Badge
      variant={question.masteryState === 'needs_attention' ? 'danger' : 'warning'}
      className="shrink-0"
    >
      {pct(question.correctRate)}
    </Badge>
  </div>
);

const WeakCriterionRow = ({ criterion }: { criterion: WeakCriterion }) => (
  <div className="flex items-center justify-between gap-3 rounded-control bg-surface-hover px-3 py-2.5">
    <div className="flex items-center gap-2 min-w-0">
      <Target
        className={cn(
          'size-4 shrink-0',
          criterion.masteryState === 'needs_attention' ? 'text-danger' : 'text-warning',
        )}
        aria-hidden
      />
      <span className="truncate text-sm text-fg">{criterion.criterion}</span>
    </div>
    <Badge
      variant={criterion.masteryState === 'needs_attention' ? 'danger' : 'warning'}
      className="shrink-0"
    >
      {pct(criterion.scoreRate)}
    </Badge>
  </div>
);

const CourseMasterySection = ({ course }: { course: CourseMasteryReport }) => {
  const hasWeakQuestions = course.weakQuestions.length > 0;
  const hasWeakCriteria = course.weakCriteria.length > 0;
  const hasAnything = hasWeakQuestions || hasWeakCriteria;

  const mcqLine =
    course.mcqMasteryPercentage !== null
      ? `${Math.round(course.mcqMasteryPercentage)}% of MCQ questions at strong level`
      : null;

  return (
    <div className="rounded-card border border-border bg-surface p-4">
      {/* Course header */}
      <div className="mb-3 flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-fg">{course.courseTitle}</span>
        <div className="flex shrink-0 items-center gap-2">
          {mcqLine ? (
            <span className="text-xs text-subtle">{mcqLine}</span>
          ) : null}
          <Badge variant={masteryBadgeVariant(course.overallMastery)}>
            {masteryLabel(course.overallMastery)}
          </Badge>
        </div>
      </div>

      {course.overallMastery === 'insufficient_data' ? (
        <p className="text-xs text-muted">
          Attempt a quiz or receive an approved grade to generate mastery evidence.
        </p>
      ) : !hasAnything ? (
        <div className="flex items-center gap-2 rounded-control bg-success-soft px-3 py-2">
          <CheckCircle2 className="size-4 shrink-0 text-success" aria-hidden />
          <span className="text-sm text-success">No weak areas detected in current evidence.</span>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {hasWeakQuestions ? (
            <div>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-subtle">
                Questions to revisit
              </p>
              <div className="flex flex-col gap-1.5">
                {course.weakQuestions.slice(0, 5).map((q) => (
                  <WeakQuestionRow key={q.questionId} question={q} />
                ))}
                {course.weakQuestions.length > 5 ? (
                  <p className="px-1 text-xs text-muted">
                    +{course.weakQuestions.length - 5} more questions below threshold.
                  </p>
                ) : null}
              </div>
            </div>
          ) : null}

          {hasWeakCriteria ? (
            <div>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-subtle">
                Assignment criteria to improve
              </p>
              <div className="flex flex-col gap-1.5">
                {course.weakCriteria.map((c) => (
                  <WeakCriterionRow key={c.criterion} criterion={c} />
                ))}
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
};

// ──────────────────────────────────────────────────────────────────────────────
// Main export
// ──────────────────────────────────────────────────────────────────────────────

export const MasteryReportCard = () => {
  const { data, isLoading, isError } = useMasteryReport();

  if (isLoading) {
    return <Skeleton className="h-64 w-full" />;
  }

  if (isError || !data) {
    return (
      <Card padding="sm">
        <EmptyState
          icon={AlertCircle}
          title="Mastery report unavailable"
          description="The mastery report could not be loaded right now."
        />
      </Card>
    );
  }

  const hasCourses = data.courses.length > 0;
  const overallVariant: 'danger' | 'warning' | 'success' | 'neutral' =
    data.coursesNeedingAttention > 0
      ? 'danger'
      : data.coursesWithEvidence > 0
        ? 'success'
        : 'neutral';

  const overallLabel =
    data.coursesNeedingAttention > 0
      ? `${data.coursesNeedingAttention} course${data.coursesNeedingAttention > 1 ? 's' : ''} need attention`
      : data.coursesWithEvidence > 0
        ? 'Looking good'
        : 'No evidence yet';

  return (
    <Card padding="sm" className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-semibold text-fg">
            <Microscope className="size-4 text-muted" aria-hidden />
            Mastery detail
          </h2>
          <p className="mt-1 text-sm text-muted">
            Per-question MCQ accuracy and assignment rubric performance. Thresholds: strong ≥ 80%,
            developing ≥ 60%, needs attention &lt; 60%.
          </p>
        </div>
        <Badge variant={overallVariant} className="shrink-0">
          {overallLabel}
        </Badge>
      </div>

      {!hasCourses ? (
        <EmptyState
          icon={Microscope}
          title="No enrolled courses yet"
          description="Enroll in a course, attempt a quiz, or receive a graded assignment to see mastery detail."
        />
      ) : (
        <div className="flex flex-col gap-3">
          {data.courses.map((course) => (
            <CourseMasterySection key={course.courseId} course={course} />
          ))}
        </div>
      )}
    </Card>
  );
};
