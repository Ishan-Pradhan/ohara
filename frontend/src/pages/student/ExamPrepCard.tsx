import { useState } from 'react';
import {
  AlertCircle,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  FlaskConical,
  Info,
  Lightbulb,
  RefreshCw,
  Shield,
  TriangleAlert,
} from 'lucide-react';

import { useStudentDashboard } from '../../features/dashboard/useDashboard.js';
import { useQuizzes } from '../../features/quizzes/useQuizzes.js';
import { useAssignments } from '../../features/assignments/useAssignments.js';
import { useExamPrep } from '../../features/dashboard/useExamPrep.js';
import type { ReadinessState } from '../../features/dashboard/examPrep.schema.js';
import { Card } from '../../components/ui/Card.js';
import { Badge } from '../../components/ui/Badge.js';
import { Button } from '../../components/ui/Button.js';
import { Select } from '../../components/ui/Select.js';
import { Skeleton } from '../../components/ui/Skeleton.js';
import { EmptyState } from '../../components/ui/EmptyState.js';
import { ProgressRing } from '../../components/ui/ProgressRing.js';
import { cn } from '../../lib/cn.js';
import { useCurrentUser } from '../../features/auth/useAuth.js';

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────

const readinessBadgeVariant = (
  state: ReadinessState,
): 'success' | 'primary' | 'danger' | 'neutral' => {
  if (state === 'ready') return 'success';
  if (state === 'developing') return 'primary';
  if (state === 'needs_attention') return 'danger';
  return 'neutral';
};

const readinessLabel = (state: ReadinessState): string => {
  if (state === 'ready') return 'Ready';
  if (state === 'developing') return 'Developing';
  if (state === 'needs_attention') return 'Needs attention';
  return 'Insufficient data';
};

const readinessColor = (state: ReadinessState) => {
  if (state === 'ready') return 'text-success';
  if (state === 'developing') return 'text-primary';
  if (state === 'needs_attention') return 'text-danger';
  return 'text-subtle';
};

const readinessRingValue = (score: number | null, state: ReadinessState): number => {
  if (score !== null) return score;
  if (state === 'insufficient_data') return 0;
  return 0;
};

// ──────────────────────────────────────────────────────────────────────────────
// Assessment type toggle
// ──────────────────────────────────────────────────────────────────────────────

interface TypeTabProps {
  type: 'quiz' | 'assignment';
  current: 'quiz' | 'assignment';
  onChange: (v: 'quiz' | 'assignment') => void;
}

const TypeTab = ({ type, current, onChange }: TypeTabProps) => {
  const isActive = type === current;
  return (
    <button
      type="button"
      onClick={() => onChange(type)}
      aria-pressed={isActive}
      className={cn(
        'flex items-center gap-1.5 rounded-control px-3 py-1.5 text-sm font-medium transition-colors',
        isActive
          ? 'bg-primary text-primary-fg shadow-sm'
          : 'text-subtle hover:text-fg hover:bg-surface-hover',
      )}
    >
      {type === 'quiz' ? (
        <FlaskConical className="size-3.5" aria-hidden />
      ) : (
        <ClipboardList className="size-3.5" aria-hidden />
      )}
      {type === 'quiz' ? 'Quiz' : 'Assignment'}
    </button>
  );
};

// ──────────────────────────────────────────────────────────────────────────────
// Readiness ring section
// ──────────────────────────────────────────────────────────────────────────────

interface ReadinessDisplayProps {
  readinessScore: number | null;
  readinessState: ReadinessState;
  assessmentTitle: string;
  alreadyCompleted: boolean;
}

const ReadinessDisplay = ({
  readinessScore,
  readinessState,
  assessmentTitle,
  alreadyCompleted,
}: ReadinessDisplayProps) => {
  const ringValue = readinessRingValue(readinessScore, readinessState);

  return (
    <div className="flex items-center gap-4 rounded-card border border-border bg-surface p-4">
      {readinessState === 'insufficient_data' ? (
        <div className="flex size-16 shrink-0 items-center justify-center rounded-full border-2 border-dashed border-border">
          <Info className="size-6 text-subtle" aria-hidden />
        </div>
      ) : (
        <ProgressRing
          value={ringValue}
          size={64}
          strokeWidth={6}
          label={`Readiness for ${assessmentTitle}`}
          className="shrink-0"
        />
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span
            className={cn('text-base font-semibold', readinessColor(readinessState))}
          >
            {readinessLabel(readinessState)}
          </span>
          <Badge variant={readinessBadgeVariant(readinessState)} className="shrink-0">
            {readinessState === 'insufficient_data'
              ? 'No data'
              : `${Math.round(ringValue)}%`}
          </Badge>
        </div>
        <p className="mt-0.5 truncate text-sm text-muted">
          {alreadyCompleted
            ? 'Based on your submission/attempt result'
            : 'Based on your course performance history'}
        </p>
        {readinessState === 'insufficient_data' ? (
          <p className="mt-1 text-xs text-subtle">
            Complete a quiz or receive an approved grade to generate a readiness estimate.
          </p>
        ) : null}
      </div>
    </div>
  );
};

// ──────────────────────────────────────────────────────────────────────────────
// Weak areas
// ──────────────────────────────────────────────────────────────────────────────

const WeakAreasList = ({ areas }: { areas: string[] }) => {
  if (areas.length === 0) return null;

  return (
    <div>
      <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-subtle">
        Areas to focus on
      </p>
      <div className="flex flex-col gap-1.5">
        {areas.map((area) => (
          <div
            key={area}
            className="flex items-start gap-2 rounded-control bg-surface-hover px-3 py-2.5"
          >
            <TriangleAlert
              className="mt-0.5 size-4 shrink-0 text-warning"
              aria-hidden
            />
            <span className="text-sm text-fg">{area}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

// ──────────────────────────────────────────────────────────────────────────────
// AI explanation block
// ──────────────────────────────────────────────────────────────────────────────

interface AIBlockProps {
  explanation: string;
  recommendations: string[];
}

const AIBlock = ({ explanation, recommendations }: AIBlockProps) => (
  <div className="rounded-card border border-primary/20 bg-primary/5 p-4">
    <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-primary">
      <Lightbulb className="size-3.5" aria-hidden />
      AI analysis
    </p>
    <p className="text-sm text-fg leading-relaxed">{explanation}</p>
    {recommendations.length > 0 ? (
      <div className="mt-3">
        <p className="mb-1.5 text-xs font-semibold text-fg">Recommended actions</p>
        <ul className="flex flex-col gap-1.5">
          {recommendations.map((rec, i) => (
            <li key={i} className="flex items-start gap-2">
              <ChevronRight
                className="mt-0.5 size-4 shrink-0 text-primary"
                aria-hidden
              />
              <span className="text-sm text-fg">{rec}</span>
            </li>
          ))}
        </ul>
      </div>
    ) : null}
  </div>
);

// ──────────────────────────────────────────────────────────────────────────────
// Course + assessment pickers
// ──────────────────────────────────────────────────────────────────────────────

interface PickersProps {
  courseId: string;
  setCourseId: (id: string) => void;
  assessmentType: 'quiz' | 'assignment';
  setAssessmentType: (t: 'quiz' | 'assignment') => void;
  assessmentId: string;
  setAssessmentId: (id: string) => void;
  courseOptions: { value: string; label: string }[];
}

const Pickers = ({
  courseId,
  setCourseId,
  assessmentType,
  setAssessmentType,
  assessmentId,
  setAssessmentId,
  courseOptions,
}: PickersProps) => {
  const { data: quizzes, isLoading: quizzesLoading } = useQuizzes(courseId);
  const { data: assignments, isLoading: assignmentsLoading } = useAssignments(courseId);

  const assessmentOptions =
    assessmentType === 'quiz'
      ? (quizzes ?? [])
          .filter((q) => q.status === 'published')
          .map((q) => ({ value: q.id, label: q.title }))
      : (assignments ?? []).map((a) => ({ value: a.id, label: a.title }));

  const isLoadingAssessments = assessmentType === 'quiz' ? quizzesLoading : assignmentsLoading;

  const handleCourseChange = (id: string) => {
    setCourseId(id);
    setAssessmentId('');
  };

  const handleTypeChange = (t: 'quiz' | 'assignment') => {
    setAssessmentType(t);
    setAssessmentId('');
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Course picker */}
      <div>
        <label className="mb-1 block text-xs font-medium text-subtle">Course</label>
        <Select
          value={courseId}
          onValueChange={handleCourseChange}
          options={courseOptions}
          placeholder="Select a course…"
        />
      </div>

      {courseId ? (
        <>
          {/* Assessment type toggle */}
          <div>
            <label className="mb-1 block text-xs font-medium text-subtle">Type</label>
            <div className="flex gap-1 rounded-card border border-border bg-surface-hover p-1 w-fit">
              <TypeTab type="quiz" current={assessmentType} onChange={handleTypeChange} />
              <TypeTab type="assignment" current={assessmentType} onChange={handleTypeChange} />
            </div>
          </div>

          {/* Assessment picker */}
          <div>
            <label className="mb-1 block text-xs font-medium text-subtle">
              {assessmentType === 'quiz' ? 'Quiz' : 'Assignment'}
            </label>
            {isLoadingAssessments ? (
              <Skeleton className="h-10 w-full" />
            ) : assessmentOptions.length === 0 ? (
              <p className="text-sm text-muted">
                No published {assessmentType === 'quiz' ? 'quizzes' : 'assignments'} in this course.
              </p>
            ) : (
              <Select
                value={assessmentId}
                onValueChange={setAssessmentId}
                options={assessmentOptions}
                placeholder={`Select a ${assessmentType}…`}
              />
            )}
          </div>
        </>
      ) : null}
    </div>
  );
};

// ──────────────────────────────────────────────────────────────────────────────
// Main component
// ──────────────────────────────────────────────────────────────────────────────

export const ExamPrepCard = () => {
  const { data: currentUser } = useCurrentUser();
  const isStudent = currentUser?.role === 'student';

  const { data: dashboard, isLoading: dashboardLoading } = useStudentDashboard(isStudent);

  const [courseId, setCourseId] = useState('');
  const [assessmentType, setAssessmentType] = useState<'quiz' | 'assignment'>('quiz');
  const [assessmentId, setAssessmentId] = useState('');

  const {
    data: examPrep,
    isLoading: prepLoading,
    isError: prepError,
    refetch,
    isFetching,
  } = useExamPrep(
    assessmentId ? assessmentType : null,
    assessmentId || null,
  );

  if (dashboardLoading) {
    return <Skeleton className="h-64 w-full" />;
  }

  const courses = dashboard?.courses ?? [];
  const courseOptions = courses.map((c) => ({ value: c.id, label: c.title }));

  if (courses.length === 0) {
    return (
      <Card padding="sm">
        <EmptyState
          icon={BookOpen}
          title="No enrolled courses"
          description="Enroll in a course to use exam preparation mode."
        />
      </Card>
    );
  }

  return (
    <Card padding="sm" className="flex flex-col gap-5">
      {/* Header */}
      <div>
        <h2 className="flex items-center gap-2 text-sm font-semibold text-fg">
          <Shield className="size-4 text-muted" aria-hidden />
          Exam preparation
        </h2>
        <p className="mt-1 text-sm text-muted">
          Select a quiz or assignment to see your readiness, weak areas, and AI-powered review
          recommendations.
        </p>
      </div>

      {/* Pickers */}
      <Pickers
        courseId={courseId}
        setCourseId={setCourseId}
        assessmentType={assessmentType}
        setAssessmentType={setAssessmentType}
        assessmentId={assessmentId}
        setAssessmentId={setAssessmentId}
        courseOptions={courseOptions}
      />

      {/* Results */}
      {assessmentId ? (
        prepLoading || isFetching ? (
          <div className="flex flex-col gap-3">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : prepError || !examPrep ? (
          <Card padding="sm">
            <EmptyState
              icon={AlertCircle}
              title="Exam prep unavailable"
              description="Could not load readiness data for this assessment. Please try again."
              action={
                <Button variant="secondary" size="sm" onClick={() => void refetch()}>
                  <RefreshCw className="size-4" aria-hidden />
                  Retry
                </Button>
              }
            />
          </Card>
        ) : (
          <div className="flex flex-col gap-4">
            {/* Readiness ring */}
            <ReadinessDisplay
              readinessScore={examPrep.readinessScore}
              readinessState={examPrep.readinessState}
              assessmentTitle={examPrep.assessmentTitle}
              alreadyCompleted={examPrep.alreadyCompleted}
            />

            {/* Already completed banner */}
            {examPrep.alreadyCompleted ? (
              <div className="flex items-center gap-2 rounded-control bg-success-soft px-3 py-2.5">
                <CheckCircle2 className="size-4 shrink-0 text-success" aria-hidden />
                <span className="text-sm text-success">
                  You have already{' '}
                  {examPrep.assessmentType === 'quiz' ? 'attempted this quiz' : 'submitted this assignment'}.
                  {examPrep.readinessScore !== null
                    ? ` Score: ${Math.round(examPrep.readinessScore)}%.`
                    : ''}
                </span>
              </div>
            ) : null}

            {/* Weak areas */}
            {examPrep.weakAreas.length > 0 ? (
              <WeakAreasList areas={examPrep.weakAreas} />
            ) : examPrep.readinessState !== 'insufficient_data' ? (
              <div className="flex items-center gap-2 rounded-control bg-success-soft px-3 py-2">
                <CheckCircle2 className="size-4 shrink-0 text-success" aria-hidden />
                <span className="text-sm text-success">No specific weak areas detected.</span>
              </div>
            ) : null}

            {/* AI explanation */}
            {examPrep.ai ? (
              <AIBlock
                explanation={examPrep.ai.explanation}
                recommendations={examPrep.ai.recommendations}
              />
            ) : examPrep.readinessState !== 'insufficient_data' ? (
              <p className="text-xs text-muted">AI analysis unavailable for this assessment.</p>
            ) : null}

            {/* Refresh button */}
            <Button
              variant="secondary"
              size="sm"
              onClick={() => void refetch()}
              disabled={isFetching}
              className="self-start"
            >
              <RefreshCw
                className={cn('size-4', isFetching && 'animate-spin')}
                aria-hidden
              />
              {isFetching ? 'Refreshing…' : 'Refresh'}
            </Button>
          </div>
        )
      ) : (
        // No assessment selected yet
        <div className="flex flex-col items-center justify-center gap-2 rounded-card border border-dashed border-border py-10 text-center">
          <Shield className="size-8 text-subtle" aria-hidden />
          <p className="text-sm font-medium text-subtle">
            {courseId
              ? `Select a ${assessmentType} above to check your readiness`
              : 'Select a course to get started'}
          </p>
        </div>
      )}
    </Card>
  );
};
