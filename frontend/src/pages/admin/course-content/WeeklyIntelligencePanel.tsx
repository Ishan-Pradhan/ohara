import { formatDistanceToNow } from 'date-fns';
import { Calendar, Users, FileText, AlertTriangle, Lightbulb, Loader2, RefreshCw } from 'lucide-react';
import {
  useWeeklySummary,
  useGenerateWeeklySummaryInsights,
} from '../../../features/teacherIntelligence/useWeeklyIntelligence.js';
import type { WeeklySummary } from '../../../features/teacherIntelligence/weeklyIntelligence.schema.js';
import { Card } from '../../../components/ui/Card.js';
import { Badge } from '../../../components/ui/Badge.js';
import { Button } from '../../../components/ui/Button.js';
import { Skeleton } from '../../../components/ui/Skeleton.js';
import { EmptyState } from '../../../components/ui/EmptyState.js';

interface WeeklyIntelligencePanelProps {
  courseId: string;
}

function MetricRow({ label, value, icon: Icon }: { label: string; value: string | number; icon: React.ComponentType<{ className?: string }> }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <Icon className="size-4 text-muted" aria-hidden />
      <span className="text-muted">{label}:</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

export const WeeklyIntelligencePanel = ({ courseId }: WeeklyIntelligencePanelProps) => {
  const { data: summary, isLoading, error } = useWeeklySummary(courseId);

  if (isLoading) {
    return (
      <Card>
        <Skeleton className="h-6 w-48 mb-4" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      </Card>
    );
  }

  if (error || !summary) {
    return (
      <EmptyState
        icon={Calendar}
        title="Weekly summary unavailable"
        description="Could not load the weekly intelligence summary."
      />
    );
  }

  const { attendance, submissions, quizzes, atRiskStudents, insights } = summary;

  return (
    <div className="flex flex-col gap-4">
      {/* Week header */}
      <Card>
        <div className="flex items-center gap-2 mb-3">
          <Calendar className="size-5 text-primary" aria-hidden />
          <h3 className="text-sm font-semibold">Weekly Intelligence</h3>
          <Badge variant="neutral">{summary.week}</Badge>
        </div>
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-muted text-xs">Class Average</p>
            <p className="text-lg font-semibold">{summary.classAverage !== null ? `${summary.classAverage.toFixed(1)}%` : 'N/A'}</p>
          </div>
          <div>
            <p className="text-muted text-xs">Enrolled</p>
            <p className="text-lg font-semibold">{summary.enrollmentCount}</p>
          </div>
          <div>
            <p className="text-muted text-xs">At Risk</p>
            <p className="text-lg font-semibold">{atRiskStudents.length}</p>
          </div>
        </div>
      </Card>

      {/* Attendance */}
      <Card>
        <h3 className="text-sm font-semibold mb-2">Attendance</h3>
        <div className="flex flex-col gap-1">
          <MetricRow icon={Users} label="Sessions" value={attendance.sessions} />
          <MetricRow icon={Users} label="Rate" value={attendance.attendanceRate !== null ? `${attendance.attendanceRate.toFixed(1)}%` : 'N/A'} />
          <div className="flex gap-2 mt-1">
            <Badge variant="success">Present: {attendance.present}</Badge>
            <Badge variant="danger">Absent: {attendance.absent}</Badge>
            <Badge variant="warning">Late: {attendance.late}</Badge>
          </div>
        </div>
      </Card>

      {/* Submissions */}
      <Card>
        <h3 className="text-sm font-semibold mb-2">Submissions</h3>
        <div className="flex flex-col gap-1">
          <MetricRow icon={FileText} label="Required" value={submissions.total} />
          <div className="flex gap-2 mt-1">
            <Badge variant="success">Submitted: {submissions.submitted}</Badge>
            <Badge variant="warning">Late: {submissions.late}</Badge>
            <Badge variant="danger">Missing: {submissions.notSubmitted}</Badge>
          </div>
        </div>
      </Card>

      {/* Quizzes */}
      <Card>
        <h3 className="text-sm font-semibold mb-2">Quizzes</h3>
        <div className="flex flex-col gap-1">
          <MetricRow icon={FileText} label="Available" value={quizzes.total} />
          <MetricRow icon={FileText} label="Attempts" value={quizzes.attempted} />
          <MetricRow icon={FileText} label="Avg Score" value={quizzes.averageScore !== null ? `${quizzes.averageScore.toFixed(1)}%` : 'N/A'} />
        </div>
      </Card>

      {/* At-risk students */}
      {atRiskStudents.length > 0 && (
        <Card>
          <h3 className="text-sm font-semibold mb-2">At-Risk Students</h3>
          <div className="flex flex-col gap-1">
            {atRiskStudents.map((s) => (
              <div key={s.name} className="flex items-center gap-2 text-sm">
                <AlertTriangle className="size-3.5 text-danger" aria-hidden />
                <span className="font-medium">{s.name}</span>
                <span className="text-muted">— avg {s.average !== null ? `${s.average.toFixed(0)}%` : 'N/A'}, attendance {s.attendance !== null ? `${s.attendance.toFixed(0)}%` : 'N/A'}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* AI Insights — explicitly triggered, never automatic, so the header
          always states exactly when it was last generated. */}
      <WeeklyPanelInsightsCard
        courseId={courseId}
        insights={insights}
        insightsGeneratedAt={summary.insightsGeneratedAt}
      />
    </div>
  );
};

const WeeklyPanelInsightsCard = ({
  courseId,
  insights,
  insightsGeneratedAt,
}: {
  courseId: string;
  insights: WeeklySummary['insights'];
  insightsGeneratedAt: string | null;
}) => {
  const { mutate: generate, isPending } = useGenerateWeeklySummaryInsights(courseId);

  const refreshButton = (
    <Button size="sm" variant="secondary" onClick={() => generate()} disabled={isPending}>
      {isPending ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <RefreshCw className="size-3.5" aria-hidden />}
      {insights ? 'Refresh' : 'Generate'}
    </Button>
  );

  if (!insights) {
    return (
      <Card>
        <EmptyState
          icon={Lightbulb}
          title="No AI insights yet"
          description="Generate a summary of this week's highlights, concerns, and recommended actions for this course. Only runs when you ask — never automatically."
          action={refreshButton}
        />
      </Card>
    );
  }

  return (
    <Card>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-sm font-semibold">AI Insights</h3>
        <div className="flex items-center gap-2">
          {insightsGeneratedAt ? (
            <span className="text-xs text-subtle">
              Generated {formatDistanceToNow(new Date(insightsGeneratedAt), { addSuffix: true })}
            </span>
          ) : null}
          {refreshButton}
        </div>
      </div>
      <p className="text-sm text-muted mb-2">{insights.summary}</p>
      {insights.highlights.length > 0 && (
        <div className="mb-2">
          <p className="text-xs font-medium text-muted uppercase mb-1">Highlights</p>
          <ul className="list-disc list-inside text-sm">
            {insights.highlights.map((h, i) => <li key={i}>{h}</li>)}
          </ul>
        </div>
      )}
      {insights.concerns.length > 0 && (
        <div className="mb-2">
          <p className="text-xs font-medium text-muted uppercase mb-1">Concerns</p>
          <ul className="list-disc list-inside text-sm">
            {insights.concerns.map((c, i) => <li key={i}>{c}</li>)}
          </ul>
        </div>
      )}
      {insights.recommendations.length > 0 && (
        <div>
          <p className="text-xs font-medium text-muted uppercase mb-1">Recommendations</p>
          <ul className="list-disc list-inside text-sm">
            {insights.recommendations.map((r, i) => <li key={i}>{r}</li>)}
          </ul>
        </div>
      )}
    </Card>
  );
};
