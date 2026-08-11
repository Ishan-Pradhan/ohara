import { GraduationCap, MapPin, Users, BookOpen, AlertTriangle, ArrowRight, BarChart3, School, ClipboardList, CalendarDays } from 'lucide-react';
import { Link } from 'react-router-dom';

import { useCurrentUser } from '../features/auth/useAuth.js';
import { useInstitutionProfile } from '../features/institution/useInstitution.js';
import { useStudentPlacement } from '../features/placement/usePlacement.js';
import { useTeacherDashboard } from '../features/teacherIntelligence/useTeacherDashboard.js';
import { AppShell } from '../components/layout/AppShell.js';
import { PageHeader } from '../components/layout/PageHeader.js';
import { Card } from '../components/ui/Card.js';
import { Badge } from '../components/ui/Badge.js';
import { Skeleton } from '../components/ui/Skeleton.js';
import { EmptyState } from '../components/ui/EmptyState.js';
import { SetupChecklist } from './SetupChecklist.js';
import { BirthdayWidget } from '../components/admin/BirthdayWidget.js';
import { StudentDashboardWidgets } from './student/StudentDashboardWidgets.js';
import { EventsWidget } from './EventsWidget.js';

const roleBadge = {
  admin: { label: 'Administrator', variant: 'primary' as const },
  teacher: { label: 'Teacher', variant: 'accent' as const },
  student: { label: 'Student', variant: 'success' as const },
  alumni: { label: 'Alumni', variant: 'neutral' as const },
};

export const DashboardPage = () => {
  const { data: user, isLoading } = useCurrentUser();
  const { data: institution } = useInstitutionProfile();

  return (
    <AppShell>
      {isLoading || !user ? (
        <div className="flex flex-col gap-6">
          <Skeleton className="h-9 w-64" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : (
        <>
          <PageHeader
            title={`Welcome back, ${user.name.split(' ')[0]}`}
            description={
              institution
                ? `Here's what's happening at ${institution.name}.`
                : "Here's what's happening at your institution."
            }
            actions={<Badge variant={roleBadge[user.role].variant}>{roleBadge[user.role].label}</Badge>}
          />

          {user.role === 'student' ? <PlacementCard studentId={user.id} /> : null}

          {user.role === 'admin' ? (
            <AdminDashboard />
          ) : user.role === 'student' ? (
            <StudentDashboardWidgets />
          ) : user.role === 'teacher' ? (
            <TeacherDashboard />
          ) : (
            <Card>
              <div className="flex items-start gap-4">
                <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary-soft">
                  <GraduationCap className="size-5.5 text-primary" aria-hidden />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-fg">Academic tools are on the way</h2>
                  <p className="mt-1 text-sm text-muted">
                    Your account, sign-in, and this dashboard are ready. Courses, quizzes, the AI
                    tutor, and everything else your role needs will appear here as each part of the
                    institution rolls out.
                  </p>
                </div>
              </div>
            </Card>
          )}

          <div className="mt-6">
            <EventsWidget />
          </div>
        </>
      )}
    </AppShell>
  );
};

function AdminDashboard() {
  return (
    <div className="flex flex-col gap-6">
      <BirthdayWidget />
      <SetupChecklist />
      <QuickActions />
    </div>
  );
}

function QuickActions() {
  const actions = [
    { label: 'Analytics', description: 'Institution-wide performance & insights', to: '/admin/analytics', icon: BarChart3, color: 'text-primary' },
    { label: 'At-Risk Students', description: 'Students needing attention', to: '/at-risk', icon: AlertTriangle, color: 'text-danger' },
    { label: 'Structure', description: 'Programs, classes & courses', to: '/admin/structure', icon: School, color: 'text-accent' },
    { label: 'Academic Years', description: 'Years, terms & scheduling', to: '/admin/academic-years', icon: CalendarDays, color: 'text-success' },
    { label: 'Students', description: 'Manage student accounts', to: '/admin/students', icon: Users, color: 'text-primary' },
    { label: 'Staff', description: 'Teachers & administrators', to: '/admin/staff', icon: ClipboardList, color: 'text-muted' },
  ];

  return (
    <div>
      <h2 className="text-sm font-semibold mb-3">Quick Actions</h2>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {actions.map((action) => (
          <Link key={action.label} to={action.to}>
            <Card className="hover:border-primary/40 transition-colors cursor-pointer group">
              <div className="flex items-start gap-3">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-surface-hover">
                  <action.icon className={`size-4.5 ${action.color}`} aria-hidden />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <h3 className="text-sm font-medium group-hover:text-primary transition-colors">{action.label}</h3>
                    <ArrowRight className="size-3 text-subtle opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <p className="text-xs text-muted mt-0.5 truncate">{action.description}</p>
                </div>
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}

function TeacherDashboard() {
  const { data: dashboard, isLoading, error } = useTeacherDashboard();

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-4">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
        <Skeleton className="h-48" />
      </div>
    );
  }

  if (error || !dashboard) {
    return (
      <EmptyState
        icon={BarChart3}
        title="Dashboard unavailable"
        description="Could not load your dashboard data."
      />
    );
  }

  const { insights } = dashboard;

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <div className="flex items-center gap-2 mb-1">
            <BookOpen className="size-4 text-muted" aria-hidden />
            <span className="text-xs text-muted">Courses</span>
          </div>
          <p className="text-2xl font-bold">{dashboard.totalCourses}</p>
        </Card>
        <Card>
          <div className="flex items-center gap-2 mb-1">
            <Users className="size-4 text-muted" aria-hidden />
            <span className="text-xs text-muted">Total Students</span>
          </div>
          <p className="text-2xl font-bold">{dashboard.totalStudents}</p>
        </Card>
        <Card>
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="size-4 text-muted" aria-hidden />
            <span className="text-xs text-muted">At-Risk</span>
          </div>
          <p className="text-2xl font-bold">{dashboard.totalAtRisk}</p>
        </Card>
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold">Your Courses</h2>
          <Link to="/teacher/courses" className="text-sm text-primary hover:underline flex items-center gap-1">
            View all <ArrowRight className="size-3.5" />
          </Link>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {dashboard.courses.map((course) => (
            <Link key={course.courseId} to={`/teacher/courses/${course.courseId}`}>
              <Card className="hover:border-primary/40 transition-colors cursor-pointer">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold">{course.courseName}</h3>
                  {course.atRiskCount > 0 && (
                    <Badge variant="danger">{course.atRiskCount} at-risk</Badge>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-2 text-sm">
                  <div>
                    <p className="text-muted text-xs">Average</p>
                    <p className="font-medium">{course.classAverage !== null ? `${course.classAverage.toFixed(1)}%` : '—'}</p>
                  </div>
                  <div>
                    <p className="text-muted text-xs">Attendance</p>
                    <p className="font-medium">{course.attendanceRate !== null ? `${course.attendanceRate.toFixed(1)}%` : '—'}</p>
                  </div>
                  <div>
                    <p className="text-muted text-xs">Students</p>
                    <p className="font-medium">{course.enrollmentCount}</p>
                  </div>
                </div>
                {course.topPerformers.length > 0 && (
                  <p className="mt-2 text-xs text-muted truncate">
                    Top: {course.topPerformers.map((s) => s.studentName).join(', ')}
                  </p>
                )}
              </Card>
            </Link>
          ))}
        </div>
      </div>

      {insights && (
        <Card>
          <h2 className="text-sm font-semibold mb-2">Insights</h2>
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
    </div>
  );
}

const PlacementCard = ({ studentId }: { studentId: string }) => {
  const { data: placement, isLoading, isError } = useStudentPlacement(studentId);

  if (isLoading) {
    return <Skeleton className="mb-6 h-28 w-full" />;
  }

  if (isError || !placement) {
    return (
      <div className="mb-6">
        <EmptyState
          icon={MapPin}
          title="Not placed yet"
          description="Your admin hasn't placed you into a class and section for this academic year yet."
        />
      </div>
    );
  }

  return (
    <Card className="mb-6">
      <div className="grid grid-cols-2 gap-x-8 gap-y-4 sm:grid-cols-4">
        <div>
          <p className="text-xs text-subtle">Program</p>
          <p className="text-sm font-medium text-fg">{placement.program?.name ?? '—'}</p>
          {placement.program?.affiliation ? (
            <p className="mt-0.5 text-xs text-muted">{placement.program.affiliation}</p>
          ) : null}
        </div>
        <div>
          <p className="text-xs text-subtle">Class</p>
          <p className="text-sm font-medium text-fg">{placement.class?.name ?? '—'}</p>
        </div>
        <div>
          <p className="text-xs text-subtle">Section</p>
          <p className="text-sm font-medium text-fg">{placement.section?.name ?? '—'}</p>
        </div>
        <div>
          <p className="text-xs text-subtle">Academic year</p>
          <p className="text-sm font-medium text-fg">{placement.academicYear?.name ?? '—'}</p>
        </div>
      </div>
    </Card>
  );
};
