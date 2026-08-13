import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Ban, BookOpen, ChevronLeft, ShieldCheck } from 'lucide-react';

import { useUser, useStaffCourses, useToggleBlockUser } from '../../features/users/useUsers.js';
import { useCurrentUser } from '../../features/auth/useAuth.js';
import { toast } from '../../lib/toast.js';
import { AppShell } from '../../components/layout/AppShell.js';
import { PageHeader } from '../../components/layout/PageHeader.js';
import { Card } from '../../components/ui/Card.js';
import { Button } from '../../components/ui/Button.js';
import { Skeleton } from '../../components/ui/Skeleton.js';
import { EmptyState } from '../../components/ui/EmptyState.js';
import { ConfirmDialog } from '../../components/ui/Dialog.js';
import { StaffInfoCard } from './StaffInfoCard.js';

export const StaffDetailPage = () => {
  const { id = '' } = useParams();
  const { data: user, isLoading } = useUser(id);
  const { data: courses, isLoading: coursesLoading } = useStaffCourses(id, user?.role === 'teacher');
  const { data: currentUser } = useCurrentUser();
  const toggleBlock = useToggleBlockUser();
  const [togglingOpen, setTogglingOpen] = useState(false);

  const isSelf = currentUser?.id === id;

  const confirmToggleBlock = async () => {
    if (!user) return;
    await toggleBlock.mutateAsync(user.id);
    toast.success(user.isBlocked ? `${user.name} unblocked` : `${user.name} blocked`);
    setTogglingOpen(false);
  };

  if (isLoading || !user) {
    return (
      <AppShell>
        <Skeleton className="h-10 w-64" />
        <div className="mt-4 flex flex-col gap-2">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      </AppShell>
    );
  }

  // This page is for staff only — a student/alumni id has no business here.
  if (user.role !== 'admin' && user.role !== 'teacher') {
    return (
      <AppShell>
        <EmptyState icon={BookOpen} title="Not a staff account" description="This page is for teachers and admins only." />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <Link to="/admin/staff" className="mb-1 flex items-center gap-1 text-sm text-muted hover:text-fg">
        <ChevronLeft className="size-3.5" aria-hidden />
        Staff
      </Link>

      <PageHeader
        title="Staff profile"
        actions={
          isSelf ? undefined : (
            <Button variant={user.isBlocked ? 'secondary' : 'destructive'} onClick={() => setTogglingOpen(true)}>
              {user.isBlocked ? (
                <>
                  <ShieldCheck className="size-4" aria-hidden />
                  Unblock
                </>
              ) : (
                <>
                  <Ban className="size-4" aria-hidden />
                  Block
                </>
              )}
            </Button>
          )
        }
      />

      <div className="mb-6">
        {/* Already checked role above — AdminUser is a flat type (role
            isn't a discriminant TS can narrow the whole object on), so
            re-assert what's already been verified. */}
        <StaffInfoCard user={{ ...user, role: user.role as 'admin' | 'teacher' }} />
      </div>

      {user.role === 'teacher' ? (
        <div>
          <h2 className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-subtle">
            <BookOpen className="size-3.5" aria-hidden />
            Courses
          </h2>
          {coursesLoading ? (
            <div className="flex flex-col gap-2">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : !courses || courses.length === 0 ? (
            <EmptyState icon={BookOpen} title="Not assigned to any courses yet" />
          ) : (
            <div className="flex flex-col gap-2">
              {courses.map((course) => (
                <Card key={course.id} padding="sm" className="flex flex-wrap items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-fg">{course.title}</p>
                    <p className="truncate text-xs text-muted">{course.code}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 text-xs text-subtle">
                    {course.programName ? <span>{course.programName}</span> : null}
                    {course.className ? (
                      <span>
                        · {course.className}
                        {course.sectionName ? ` — ${course.sectionName}` : ''}
                      </span>
                    ) : null}
                    {course.batchName ? <span>· Batch {course.batchName}</span> : null}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      ) : null}

      <ConfirmDialog
        open={togglingOpen}
        onOpenChange={setTogglingOpen}
        title={user.isBlocked ? `Unblock ${user.name}?` : `Block ${user.name}?`}
        description={
          user.isBlocked
            ? 'They will regain the ability to sign in.'
            : 'They will be signed out and unable to sign back in until unblocked. Their account and academic record are untouched.'
        }
        confirmLabel={user.isBlocked ? 'Unblock' : 'Block'}
        destructive={!user.isBlocked}
        loading={toggleBlock.isPending}
        onConfirm={confirmToggleBlock}
      />
    </AppShell>
  );
};
