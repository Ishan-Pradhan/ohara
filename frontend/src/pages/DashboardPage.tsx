import { GraduationCap, MapPin } from 'lucide-react';

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
            <SetupChecklist />
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
        </>
      )}
    </AppShell>
  );
};

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
