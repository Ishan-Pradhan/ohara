import { GraduationCap, MapPin, Users, AlertTriangle, ArrowRight, BarChart3, School, ClipboardList, CalendarDays } from 'lucide-react';
import { Link } from 'react-router-dom';

import { useCurrentUser } from '../features/auth/useAuth.js';
import { useInstitutionProfile } from '../features/institution/useInstitution.js';
import { useStudentPlacement } from '../features/placement/usePlacement.js';
import { AppShell } from '../components/layout/AppShell.js';
import { PageHeader } from '../components/layout/PageHeader.js';
import { Card } from '../components/ui/Card.js';
import { Badge } from '../components/ui/Badge.js';
import { Skeleton } from '../components/ui/Skeleton.js';
import { EmptyState } from '../components/ui/EmptyState.js';
import { SetupChecklist } from './SetupChecklist.js';
import { BirthdayWidget } from '../components/admin/BirthdayWidget.js';
import { StudentDashboardWidgets } from './student/StudentDashboardWidgets.js';
import { TeacherDashboardWidgets } from './teacher/TeacherDashboardWidgets.js';
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

          {user.role === 'student' ? <PlacementStrip studentId={user.id} /> : null}

          {user.role === 'admin' ? (
            <AdminDashboard />
          ) : user.role === 'student' ? (
            <StudentDashboardWidgets />
          ) : user.role === 'teacher' ? (
            <TeacherDashboardWidgets />
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

          {/* Students already get this in StudentDashboardWidgets' sidebar column —
              rendering it again here would duplicate it and add scroll for no reason. */}
          {user.role !== 'student' ? (
            <div className="mt-6">
              <EventsWidget />
            </div>
          ) : null}
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

// A one-line breadcrumb instead of a full card — program/class/section/year
// is useful context, not something that needs a quarter of the screen above
// the fold every time a student opens the dashboard.
const PlacementStrip = ({ studentId }: { studentId: string }) => {
  const { data: placement, isLoading, isError } = useStudentPlacement(studentId);

  if (isLoading) {
    return <Skeleton className="mb-6 h-5 w-72" />;
  }

  if (isError || !placement) {
    return (
      <div className="mb-6">
        <EmptyState
          icon={MapPin}
          title="Not placed yet"
          description="Your admin hasn't placed you into a class and section yet."
        />
      </div>
    );
  }

  const parts = [
    placement.program?.name,
    placement.class?.name,
    placement.section ? `Section ${placement.section.name}` : null,
    placement.batch?.name,
  ].filter((part): part is string => Boolean(part));

  return (
    <p className="mb-6 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted">
      {parts.map((part, i) => (
        <span key={part} className="flex items-center gap-2">
          {i > 0 ? <span className="text-border" aria-hidden>·</span> : null}
          <span className="font-medium text-fg">{part}</span>
        </span>
      ))}
    </p>
  );
};
