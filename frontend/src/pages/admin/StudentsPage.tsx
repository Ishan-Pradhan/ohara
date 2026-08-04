import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Archive, GraduationCap, Mail, MoreVertical, Search, Trash2, UserPlus } from 'lucide-react';

import { useArchiveUser, useHardDeleteUser, useUsers } from '../../features/users/useUsers.js';
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
import { ConfirmDialog } from '../../components/ui/Dialog.js';
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
  const [search, setSearch] = useState('');
  const [archiving, setArchiving] = useState<AdminUser | null>(null);
  const [deleting, setDeleting] = useState<AdminUser | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);

  const { data, isLoading } = useUsers({ role: 'student', search: search || undefined, limit: 50 });
  const archiveUser = useArchiveUser();
  const hardDeleteUser = useHardDeleteUser();

  const students = data?.items ?? [];

  const confirmArchive = async () => {
    if (!archiving) return;
    await archiveUser.mutateAsync(archiving.id);
    toast.success(`${archiving.name} archived`);
    setArchiving(null);
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    try {
      await hardDeleteUser.mutateAsync(deleting.id);
      toast.success(`${deleting.name} permanently deleted`);
      setDeleting(null);
    } catch (caught) {
      if (caught instanceof ApiError) {
        toast.error(caught.message);
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
                      <DropdownMenuItem onSelect={() => setDeleting(student)} destructive>
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

      <ConfirmDialog
        open={Boolean(archiving)}
        onOpenChange={(open) => !open && setArchiving(null)}
        title="Archive this student?"
        description={`${archiving?.name} will lose access immediately. Their academic record is preserved and this can be reviewed later.`}
        confirmLabel="Archive"
        loading={archiveUser.isPending}
        onConfirm={confirmArchive}
      />

      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Permanently delete this student?"
        description={`This removes ${deleting?.name} entirely and cannot be undone. If they have any placement or enrollment history, this will be rejected — archive instead.`}
        confirmLabel="Delete permanently"
        destructive
        loading={hardDeleteUser.isPending}
        onConfirm={confirmDelete}
      />

      <InviteStudentsDialog open={inviteOpen} onOpenChange={setInviteOpen} />
    </AppShell>
  );
};
