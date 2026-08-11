import { Users, FileText } from 'lucide-react';
import { useInstitutionWeekly } from '../../features/institution/useInstitutionWeekly.js';
import { Card } from '../../components/ui/Card.js';
import { Badge } from '../../components/ui/Badge.js';
import { Skeleton } from '../../components/ui/Skeleton.js';
import { EmptyState } from '../../components/ui/EmptyState.js';

export const InstitutionWeeklyPage = () => {
  const { data: weekly, isLoading, error } = useInstitutionWeekly();

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-3 gap-4">
          <Skeleton className="h-24" /><Skeleton className="h-24" /><Skeleton className="h-24" />
        </div>
      </div>
    );
  }

  if (error || !weekly) {
    return (
      <EmptyState icon={Calendar} title="Unavailable" description="Could not load weekly data." />
    );
  }

  const { attendance, submissions, quizzes, programSummaries, insights } = weekly;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted">Week of</span>
        <Badge variant="neutral">{weekly.week}</Badge>
      </div>

      {/* Attendance */}
      <Card>
        <h2 className="text-sm font-semibold mb-2 flex items-center gap-2">
          <Users className="size-4" aria-hidden /> Attendance
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
          <div><p className="text-muted text-xs">Sessions</p><p className="font-medium">{attendance.sessionsThisWeek}</p></div>
          <div><p className="text-muted text-xs">Rate</p><p className="font-medium">{attendance.rate !== null ? `${attendance.rate.toFixed(1)}%` : '—'}</p></div>
          <div><p className="text-muted text-xs">Present</p><p className="font-medium">{attendance.present}</p></div>
          <div><p className="text-muted text-xs">Absent</p><p className="font-medium">{attendance.absent}</p></div>
          <div><p className="text-muted text-xs">Late</p><p className="font-medium">{attendance.late}</p></div>
        </div>
      </Card>

      {/* Submissions */}
      <Card>
        <h2 className="text-sm font-semibold mb-2 flex items-center gap-2">
          <FileText className="size-4" aria-hidden /> Submissions
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <div><p className="text-muted text-xs">Due</p><p className="font-medium">{submissions.dueThisWeek}</p></div>
          <div><p className="text-muted text-xs">Submitted</p><p className="font-medium">{submissions.submitted}</p></div>
          <div><p className="text-muted text-xs">Late</p><p className="font-medium">{submissions.late}</p></div>
          <div><p className="text-muted text-xs">Missing</p><p className="font-medium">{submissions.missing}</p></div>
        </div>
      </Card>

      {/* Quizzes */}
      <Card>
        <h2 className="text-sm font-semibold mb-2 flex items-center gap-2">
          <FileText className="size-4" aria-hidden /> Quizzes
        </h2>
        <div className="grid grid-cols-3 gap-3 text-sm">
          <div><p className="text-muted text-xs">Available</p><p className="font-medium">{quizzes.availableThisWeek}</p></div>
          <div><p className="text-muted text-xs">Attempts</p><p className="font-medium">{quizzes.attempts}</p></div>
          <div><p className="text-muted text-xs">Avg Score</p><p className="font-medium">{quizzes.averageScore !== null ? `${quizzes.averageScore.toFixed(1)}%` : '—'}</p></div>
        </div>
      </Card>

      {/* Program summaries */}
      {programSummaries.length > 0 && (
        <Card>
          <h2 className="text-sm font-semibold mb-2">Program Performance</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {programSummaries.map((p) => (
              <div key={p.name} className="rounded-control border border-border p-3">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="text-sm font-medium">{p.name}</h3>
                  {p.atRiskCount > 0 && <Badge variant="danger">{p.atRiskCount}</Badge>}
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div><span className="text-muted">Avg:</span> <span className="font-medium">{p.averageGrade !== null ? `${p.averageGrade.toFixed(1)}%` : '—'}</span></div>
                  <div><span className="text-muted">Att:</span> <span className="font-medium">{p.attendanceRate !== null ? `${p.attendanceRate.toFixed(1)}%` : '—'}</span></div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Insights */}
      {insights && (
        <Card>
          <h2 className="text-sm font-semibold mb-2">AI Insights</h2>
          <p className="text-sm text-muted mb-3">{insights.summary}</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {insights.highlights.length > 0 && (
              <div>
                <p className="text-xs font-medium text-success uppercase mb-1">Highlights</p>
                <ul className="list-disc list-inside text-sm space-y-0.5">{insights.highlights.map((h, i) => <li key={i}>{h}</li>)}</ul>
              </div>
            )}
            {insights.concerns.length > 0 && (
              <div>
                <p className="text-xs font-medium text-danger uppercase mb-1">Concerns</p>
                <ul className="list-disc list-inside text-sm space-y-0.5">{insights.concerns.map((c, i) => <li key={i}>{c}</li>)}</ul>
              </div>
            )}
            {insights.recommendations.length > 0 && (
              <div>
                <p className="text-xs font-medium text-primary uppercase mb-1">Actions</p>
                <ul className="list-disc list-inside text-sm space-y-0.5">{insights.recommendations.map((r, i) => <li key={i}>{r}</li>)}</ul>
              </div>
            )}
          </div>
        </Card>
      )}
    </div>
  );
};
