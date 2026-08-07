import { AlertCircle, BookOpen, FlaskConical } from 'lucide-react';

import { useConceptInventory } from '../../features/dashboard/useConceptInventory.js';
import type { CourseConcepts, ConceptSnapshot } from '../../features/dashboard/conceptInventory.schema.js';
import { Card } from '../../components/ui/Card.js';
import { Badge } from '../../components/ui/Badge.js';
import { Skeleton } from '../../components/ui/Skeleton.js';
import { EmptyState } from '../../components/ui/EmptyState.js';
import { cn } from '../../lib/cn.js';

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────

type MasteryState = ConceptSnapshot['masteryState'];

const dotColor = (state: MasteryState): string => {
  if (state === 'strong') return 'bg-success';
  if (state === 'developing') return 'bg-primary';
  if (state === 'needs_attention') return 'bg-danger';
  return 'bg-border';
};

// ──────────────────────────────────────────────────────────────────────────────
// Sub-components
// ──────────────────────────────────────────────────────────────────────────────

const TopicPill = ({ concept }: { concept: ConceptSnapshot }) => (
  <span
    className={cn(
      'inline-flex items-center gap-1.5 rounded-pill border px-2.5 py-1 text-xs font-medium',
      concept.masteryState === 'strong' && 'border-success/25 bg-success-soft text-success',
      concept.masteryState === 'developing' && 'border-primary/20 bg-primary-soft text-primary',
      concept.masteryState === 'needs_attention' && 'border-danger/25 bg-danger-soft text-danger',
      concept.masteryState === 'insufficient_data' && 'border-border bg-surface-hover text-muted',
    )}
  >
    <span
      className={cn('size-1.5 shrink-0 rounded-full', dotColor(concept.masteryState))}
      aria-hidden
    />
    {concept.topic}
  </span>
);

const CourseConceptsRow = ({ course }: { course: CourseConcepts }) => {
  const scoreLabel =
    course.hasQuizEvidence && course.quizEvidence.averageScorePercentage !== null
      ? `${course.quizEvidence.averageScorePercentage.toFixed(1)}% avg quiz · ${course.quizEvidence.attemptedCount}/${course.quizEvidence.quizCount} quizzes`
      : 'No quiz attempts yet';

  return (
    <div className="rounded-card border border-border bg-surface p-3">
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <BookOpen className="size-4 shrink-0 text-muted" aria-hidden />
          <span className="text-sm font-medium text-fg">{course.courseTitle}</span>
        </div>
        <span className="shrink-0 text-xs text-subtle">{scoreLabel}</span>
      </div>

      {course.concepts.length === 0 ? (
        <p className="text-xs text-muted">No topics defined in lessons yet.</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {course.concepts.map((concept) => (
            <TopicPill key={concept.topic} concept={concept} />
          ))}
        </div>
      )}
    </div>
  );
};

const MasterySummary = ({
  totalConcepts,
  conceptsWithEvidence,
}: {
  totalConcepts: number;
  conceptsWithEvidence: number;
}) => (
  <div className="flex flex-wrap gap-3">
    <div className="rounded-card border border-border bg-surface px-3 py-2">
      <p className="text-xs text-subtle">Total concepts</p>
      <p className="mt-1 text-sm font-semibold text-fg">{totalConcepts}</p>
    </div>
    <div className="rounded-card border border-border bg-surface px-3 py-2">
      <p className="text-xs text-subtle">With quiz evidence</p>
      <p className="mt-1 text-sm font-semibold text-fg">{conceptsWithEvidence}</p>
    </div>
    <div className="rounded-card border border-border bg-surface px-3 py-2">
      <p className="text-xs text-subtle">Without evidence</p>
      <p className="mt-1 text-sm font-semibold text-fg">{totalConcepts - conceptsWithEvidence}</p>
    </div>
  </div>
);

const LEGEND_ITEMS: Array<{ state: MasteryState; label: string }> = [
  { state: 'strong', label: 'Strong (≥80%)' },
  { state: 'developing', label: 'Developing (≥60%)' },
  { state: 'needs_attention', label: 'Needs attention (<60%)' },
  { state: 'insufficient_data', label: 'No evidence' },
];

const Legend = () => (
  <div className="flex flex-wrap gap-3">
    {LEGEND_ITEMS.map(({ state, label }) => (
      <div key={state} className="flex items-center gap-1.5">
        <span className={cn('size-2 shrink-0 rounded-full', dotColor(state))} aria-hidden />
        <span className="text-xs text-muted">{label}</span>
      </div>
    ))}
  </div>
);

// ──────────────────────────────────────────────────────────────────────────────
// Main export
// ──────────────────────────────────────────────────────────────────────────────

export const ConceptMasteryCard = () => {
  const { data, isLoading, isError } = useConceptInventory();

  if (isLoading) {
    return <Skeleton className="h-64 w-full" />;
  }

  if (isError || !data) {
    return (
      <Card padding="sm">
        <EmptyState
          icon={AlertCircle}
          title="Concept inventory unavailable"
          description="The concept inventory could not be loaded right now."
        />
      </Card>
    );
  }

  const hasCourses = data.courses.length > 0;
  const hasAnyTopics = data.totalConcepts > 0;

  const weakCourseCount = data.courses.filter(
    (c) =>
      c.hasQuizEvidence &&
      c.concepts.some((concept) => concept.masteryState === 'needs_attention'),
  ).length;

  const overallVariant: 'danger' | 'success' | 'neutral' =
    weakCourseCount > 0
      ? 'danger'
      : data.conceptsWithEvidence > 0
        ? 'success'
        : 'neutral';

  const overallLabel =
    weakCourseCount > 0
      ? `${weakCourseCount} course${weakCourseCount > 1 ? 's' : ''} need attention`
      : data.conceptsWithEvidence > 0
        ? 'On track'
        : 'Awaiting evidence';

  return (
    <Card padding="sm" className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-semibold text-fg">
            <FlaskConical className="size-4 text-muted" aria-hidden />
            Concept inventory
          </h2>
          <p className="mt-1 text-sm text-muted">
            Topics from your lessons with quiz-evidence mastery states. Scores are course-level
            proxies — questions are not tagged to individual topics.
          </p>
        </div>
        <Badge variant={overallVariant} className="shrink-0">
          {overallLabel}
        </Badge>
      </div>

      {!hasCourses ? (
        <EmptyState
          icon={BookOpen}
          title="No enrolled courses yet"
          description="Enroll in a course and complete lessons to see your concept inventory."
        />
      ) : !hasAnyTopics ? (
        <EmptyState
          icon={BookOpen}
          title="No topics defined yet"
          description="Topics appear once lessons are published with key topics."
        />
      ) : (
        <>
          <MasterySummary
            totalConcepts={data.totalConcepts}
            conceptsWithEvidence={data.conceptsWithEvidence}
          />
          <Legend />
          <div className="flex flex-col gap-3">
            {data.courses.map((course) => (
              <CourseConceptsRow key={course.courseId} course={course} />
            ))}
          </div>
        </>
      )}
    </Card>
  );
};
