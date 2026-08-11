import { Building2, Users, BookOpen, AlertTriangle, GraduationCap, TrendingUp, TrendingDown } from 'lucide-react';
import { useInstitutionPerformance } from '../../features/institution/useInstitutionPerformance.js';
import { AdminCopilotCard } from '../../features/institution/AdminCopilotCard.js';
import { Card } from '../../components/ui/Card.js';
import { Badge } from '../../components/ui/Badge.js';
import { Skeleton } from '../../components/ui/Skeleton.js';
import { EmptyState } from '../../components/ui/EmptyState.js';

function StatCard({ label, value, icon: Icon, variant }: { label: string; value: string | number; icon: React.ComponentType<{ className?: string }>; variant?: 'default' | 'danger' | 'success' }) {
  const colors = {
    default: 'text-primary',
    danger: 'text-danger',
    success: 'text-success',
  };
  return (
    <Card>
      <div className="flex items-center gap-2 mb-1">
        <Icon className={`size-4 ${colors[variant ?? 'default']}`} aria-hidden />
        <span className="text-xs text-muted">{label}</span>
      </div>
      <p className="text-2xl font-bold">{value}</p>
    </Card>
  );
}

export const InstitutionPerformancePage = () => {
  const { data: perf, isLoading, error } = useInstitutionPerformance();

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-4 gap-4">
          <Skeleton className="h-24" /><Skeleton className="h-24" /><Skeleton className="h-24" /><Skeleton className="h-24" />
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (error || !perf) {
    return (
      <EmptyState icon={Building2} title="Unavailable" description="Could not load institution performance data." />
    );
  }

  const { totals, academic, programs, topCourses, bottomCourses, insights } = perf;

  return (
    <div className="flex flex-col gap-6">
      {/* Stats overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={GraduationCap} label="Programs" value={totals.programs} />
        <StatCard icon={BookOpen} label="Courses" value={totals.courses} />
        <StatCard icon={Users} label="Students" value={totals.students} />
        <StatCard icon={Users} label="Teachers" value={totals.teachers} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={TrendingUp} label="Avg Grade" value={academic.overallAverageGrade !== null ? `${academic.overallAverageGrade.toFixed(1)}%` : '—'} />
        <StatCard icon={TrendingUp} label="Attendance" value={academic.overallAttendanceRate !== null ? `${academic.overallAttendanceRate.toFixed(1)}%` : '—'} />
        <StatCard icon={AlertTriangle} label="At-Risk" value={academic.totalAtRisk} variant={academic.totalAtRisk > 0 ? 'danger' : 'default'} />
        <StatCard icon={AlertTriangle} label="Missing Subs" value={academic.totalMissingSubmissions} variant={academic.totalMissingSubmissions > 0 ? 'danger' : 'success'} />
      </div>

      {/* Program breakdown */}
      {programs.length > 0 && (
        <Card>
          <h2 className="text-sm font-semibold mb-3">Programs</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {programs.map((p) => (
              <div key={p.name} className="rounded-control border border-border p-3">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium">{p.name}</h3>
                  {p.atRiskCount > 0 && <Badge variant="danger">{p.atRiskCount} at-risk</Badge>}
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div><span className="text-muted">Courses:</span> <span className="font-medium">{p.courseCount}</span></div>
                  <div><span className="text-muted">Students:</span> <span className="font-medium">{p.studentCount}</span></div>
                  <div><span className="text-muted">Avg:</span> <span className="font-medium">{p.averageGrade !== null ? `${p.averageGrade.toFixed(1)}%` : '—'}</span></div>
                  <div><span className="text-muted">Attendance:</span> <span className="font-medium">{p.attendanceRate !== null ? `${p.attendanceRate.toFixed(1)}%` : '—'}</span></div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Top/Bottom courses */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {topCourses.length > 0 && (
          <Card>
            <h2 className="text-sm font-semibold mb-2 flex items-center gap-2">
              <TrendingUp className="size-4 text-success" /> Top Courses
            </h2>
            <div className="flex flex-col gap-1">
              {topCourses.map((c) => (
                <div key={c.name} className="flex items-center justify-between text-sm">
                  <span>{c.name}</span>
                  <span className="font-medium">{c.averageGrade !== null ? `${c.averageGrade.toFixed(1)}%` : '—'}</span>
                </div>
              ))}
            </div>
          </Card>
        )}
        {bottomCourses.length > 0 && (
          <Card>
            <h2 className="text-sm font-semibold mb-2 flex items-center gap-2">
              <TrendingDown className="size-4 text-danger" /> Courses Needing Attention
            </h2>
            <div className="flex flex-col gap-1">
              {bottomCourses.map((c) => (
                <div key={c.name} className="flex items-center justify-between text-sm">
                  <span>{c.name}</span>
                  <span className="font-medium">{c.averageGrade !== null ? `${c.averageGrade.toFixed(1)}%` : '—'}</span>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>

      {/* AI Insights */}
      {insights && (
        <Card>
          <h2 className="text-sm font-semibold mb-2">AI Insights</h2>
          <p className="text-sm text-muted mb-3">{insights.summary}</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {insights.highlights.length > 0 && (
              <div>
                <p className="text-xs font-medium text-success uppercase mb-1">Highlights</p>
                <ul className="list-disc list-inside text-sm space-y-0.5">
                  {insights.highlights.map((h, i) => <li key={i}>{h}</li>)}
                </ul>
              </div>
            )}
            {insights.concerns.length > 0 && (
              <div>
                <p className="text-xs font-medium text-danger uppercase mb-1">Concerns</p>
                <ul className="list-disc list-inside text-sm space-y-0.5">
                  {insights.concerns.map((c, i) => <li key={i}>{c}</li>)}
                </ul>
              </div>
            )}
            {insights.recommendations.length > 0 && (
              <div>
                <p className="text-xs font-medium text-primary uppercase mb-1">Actions</p>
                <ul className="list-disc list-inside text-sm space-y-0.5">
                  {insights.recommendations.map((r, i) => <li key={i}>{r}</li>)}
                </ul>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Admin Copilot */}
      <AdminCopilotCard />
    </div>
  );
};
