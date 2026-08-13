import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Archive, GraduationCap, Mail, MoreVertical, RotateCcw, Search, Trash2, UserPlus } from 'lucide-react';

import { useArchiveUser, useHardDeleteUser, useRestoreUser, useUsers } from '../../features/users/useUsers.js';
import type { AdminUser } from '../../features/users/users.schema.js';
import { ApiError } from '../../lib/apiError.js';
import { toast } from '../../lib/toast.js';
import { AppShell } from '../../components/layout/AppShell.js';
import { PageHeader } from '../../components/layout/PageHeader.js';
import { Button } from '../../components/ui/Button.js';
import { Input } from '../../components/ui/Input.js';
import { Avatar } from '../../components/ui/Avatar.js';
import { Badge } from '../../components/ui/Badge.js';
import { Skeleton } from '../../components/ui/Skeleton.js';
import { EmptyState } from '../../components/ui/EmptyState.js';
import { BlockersList } from '../../components/ui/BlockersList.js';
import { ConfirmDialog } from '../../components/ui/Dialog.js';
import { Pagination } from '../../components/ui/Pagination.js';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../../components/ui/DropdownMenu.js';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeadCell,
  TableRow,
} from '../../components/ui/Table.js';
import { InviteStudentsDialog } from './InviteStudentsDialog.js';

const statusVariant: Record<AdminUser['status'], 'success' | 'neutral' | 'accent' | 'danger'> = {
  active: 'success',
  inactive: 'neutral',
  graduated: 'accent',
  archived: 'danger',
};

export const StudentsPage = () => {
  // search + page live in the URL (not useState) so a reload or shared link
  // lands back on the same filtered/paged view instead of resetting.
  const [searchParams, setSearchParams] = useSearchParams();
  const search = searchParams.get('search') ?? '';
  const page = Number(searchParams.get('page')) || 1;

  const setSearch = (value: string) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (value) next.set('search', value);
      else next.delete('search');
      next.delete('page'); // a new search always starts back at page 1
      return next;
    });
  };

  const setPage = (next: number) => {
    setSearchParams((prev) => {
      const params = new URLSearchParams(prev);
      if (next > 1) params.set('page', String(next));
      else params.delete('page');
      return params;
    });
  };

  const [archiving, setArchiving] = useState<AdminUser | null>(null);
  const [restoring, setRestoring] = useState<AdminUser | null>(null);
  const [deleting, setDeleting] = useState<AdminUser | null>(null);
  const [deleteError, setDeleteError] = useState<ApiError | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);

  const { data, isLoading } = useUsers({ role: 'student', search: search || undefined, page, limit: 20 });
  const archiveUser = useArchiveUser();
  const restoreUser = useRestoreUser();
  const hardDeleteUser = useHardDeleteUser();

  const students = data?.items ?? [];

  const confirmArchive = async () => {
    if (!archiving) return;
    await archiveUser.mutateAsync(archiving.id);
    toast.success(`${archiving.name} archived`);
    setArchiving(null);
  };

  const confirmRestore = async () => {
    if (!restoring) return;
    await restoreUser.mutateAsync(restoring.id);
    toast.success(`${restoring.name} restored`);
    setRestoring(null);
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    setDeleteError(null);
    try {
      await hardDeleteUser.mutateAsync(deleting.id);
      toast.success(`${deleting.name} permanently deleted`);
      setDeleting(null);
    } catch (caught) {
      if (caught instanceof ApiError) {
        setDeleteError(caught);
      }
    }
  };

  return (
    <AppShell>
      <PageHeader
        title="Students"
        description="Place students into sections, enroll them in courses, and manage their lifecycle."
        actions={
          <div className="flex gap-3">
            <Link
              to="/admin/students/admit"
              className="inline-flex items-center justify-center gap-2 rounded-control bg-primary px-4 py-2.5 text-sm font-medium text-primary-fg transition-colors hover:bg-primary-hover"
            >
              <UserPlus className="size-4" aria-hidden />
              Admit student
            </Link>
            <Button onClick={() => setInviteOpen(true)}>
              <Mail className="size-4" aria-hidden />
              Invite students
            </Button>
          </div>
        }
      />

      <div className="mb-4">
        <div className="relative max-w-xs">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-subtle" aria-hidden />
          <Input
            placeholder="Search by name or email"
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : students.length === 0 ? (
        <EmptyState
          icon={GraduationCap}
          title="No students found"
          description={
            search
              ? 'Try a different search.'
              : 'Students appear here once they register or you invite them.'
          }
          action={
            search ? undefined : (
              <Button onClick={() => setInviteOpen(true)}>Invite students</Button>
            )
          }
        />
      ) : (
        <Table>
          <TableHead>
            <TableRow>
              <TableHeadCell>Student</TableHeadCell>
              <TableHeadCell>Status</TableHeadCell>
              <TableHeadCell />
            </TableRow>
          </TableHead>
          <TableBody>
            {students.map((student) => (
              <TableRow key={student.id}>
                <TableCell>
                  <Link
                    to={`/admin/students/${student.id}`}
                    className="flex items-center gap-3 hover:underline"
                  >
                    <Avatar name={student.name} src={student.avatarUrl} size="sm" />
                    <div className="min-w-0">
                      <p className="truncate font-medium text-fg">{student.name}</p>
                      <p className="truncate text-xs text-muted">{student.email}</p>
                    </div>
                  </Link>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1.5">
                    <Badge variant={statusVariant[student.status]}>{student.status}</Badge>
                    {!student.isVerified ? <Badge>Invite pending</Badge> : null}
                  </div>
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger className="rounded-control p-1.5 text-subtle transition-colors hover:bg-surface-hover hover:text-fg">
                      <MoreVertical className="size-4" aria-hidden />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      <DropdownMenuItem
                        onSelect={() => setArchiving(student)}
                        disabled={student.status === 'archived'}
                      >
                        <Archive className="size-4" aria-hidden />
                        Archive
                      </DropdownMenuItem>
                      {student.status === 'archived' || student.status === 'inactive' ? (
                        <DropdownMenuItem onSelect={() => setRestoring(student)}>
                          <RotateCcw className="size-4" aria-hidden />
                          Restore
                        </DropdownMenuItem>
                      ) : null}
                      <DropdownMenuItem
                        onSelect={() => {
                          setDeleting(student);
                          setDeleteError(null);
                        }}
                        destructive
                      >
                        <Trash2 className="size-4" aria-hidden />
                        Delete permanently
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {data ? (
        <div className="mt-4">
          <Pagination meta={data.meta} onPageChange={setPage} />
        </div>
      ) : null}

      <ConfirmDialog
        open={Boolean(archiving)}
        onOpenChange={(open) => !open && setArchiving(null)}
        title="Archive this student?"
        description={`${archiving?.name} will lose access immediately. Their academic record is preserved and can be restored later.`}
        confirmLabel="Archive"
        loading={archiveUser.isPending}
        onConfirm={confirmArchive}
      />

      <ConfirmDialog
        open={Boolean(restoring)}
        onOpenChange={(open) => !open && setRestoring(null)}
        title="Restore this student?"
        description={`${restoring?.name} will regain access as an active student. Graduated students can't be restored this way.`}
        confirmLabel="Restore"
        loading={restoreUser.isPending}
        onConfirm={confirmRestore}
      />

      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => {
          if (!open) {
            setDeleting(null);
            setDeleteError(null);
          }
        }}
        title="Permanently delete this student?"
        description={`This removes ${deleting?.name} entirely and cannot be undone. Hard deletion is only available for students with no academic record (e.g. an invited account that was never placed). For students with placement history, use Archive instead.`}
        confirmLabel="Delete permanently"
        destructive
        loading={hardDeleteUser.isPending}
        onConfirm={confirmDelete}
      >
        {deleteError ? <BlockersList blockers={deleteError.blockers} /> : null}
      </ConfirmDialog>

      <InviteStudentsDialog open={inviteOpen} onOpenChange={setInviteOpen} />
    </AppShell>
  );
};
