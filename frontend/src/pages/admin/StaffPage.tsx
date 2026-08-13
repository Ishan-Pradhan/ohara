import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Ban, Mail, MoreVertical, Plus, ShieldCheck, UserCog } from 'lucide-react';

import { createStaffSchema, type AdminUser, type CreateStaffInput } from '../../features/users/users.schema.js';
import { useCreateStaff, useToggleBlockUser, useUsers } from '../../features/users/useUsers.js';
import type { FetchUsersResult } from '../../features/users/users.api.js';
import { useCurrentUser } from '../../features/auth/useAuth.js';
import { ApiError } from '../../lib/apiError.js';
import { toast } from '../../lib/toast.js';
import { AppShell } from '../../components/layout/AppShell.js';
import { PageHeader } from '../../components/layout/PageHeader.js';
import { Button } from '../../components/ui/Button.js';
import { Avatar } from '../../components/ui/Avatar.js';
import { Badge } from '../../components/ui/Badge.js';
import { Field } from '../../components/ui/Field.js';
import { Input } from '../../components/ui/Input.js';
import { Select } from '../../components/ui/Select.js';
import { Skeleton } from '../../components/ui/Skeleton.js';
import { EmptyState } from '../../components/ui/EmptyState.js';
import { Dialog, ConfirmDialog } from '../../components/ui/Dialog.js';
import { Alert } from '../../components/ui/Alert.js';
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

const roleOptions = [
  { value: 'teacher', label: 'Teacher' },
  { value: 'admin', label: 'Admin' },
];

/** One role's table + its own pager — Teachers and Admins are two
 * independent backend-paginated queries, so each gets its own page number
 * rather than a single control over a client-merged list. */
const StaffTable = ({
  title,
  data,
  isLoading,
  currentUserId,
  onPageChange,
  onRequestToggleBlock,
}: {
  title: string;
  data: FetchUsersResult | undefined;
  isLoading: boolean;
  currentUserId: string | undefined;
  onPageChange: (page: number) => void;
  onRequestToggleBlock: (person: AdminUser) => void;
}) => {
  const people = data?.items ?? [];

  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-sm font-semibold text-fg">{title}</h2>

      {isLoading ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : people.length === 0 ? (
        <EmptyState icon={UserCog} title={`No ${title.toLowerCase()} yet`} />
      ) : (
        <>
          <Table>
            <TableHead>
              <TableRow>
                <TableHeadCell>Name</TableHeadCell>
                <TableHeadCell>Status</TableHeadCell>
                <TableHeadCell />
              </TableRow>
            </TableHead>
            <TableBody>
              {people.map((person: AdminUser) => (
                <TableRow key={person.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar name={person.name} src={person.avatarUrl} size="sm" />
                      <div className="min-w-0">
                        <p className="truncate font-medium text-fg">{person.name}</p>
                        <p className="truncate text-xs text-muted">{person.email}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      {person.isVerified ? (
                        <Badge variant="success">Active</Badge>
                      ) : (
                        <Badge>Invite pending</Badge>
                      )}
                      {person.isBlocked ? <Badge variant="danger">Blocked</Badge> : null}
                    </div>
                  </TableCell>
                  <TableCell>
                    {person.id === currentUserId ? null : (
                      <DropdownMenu>
                        <DropdownMenuTrigger className="rounded-control p-1.5 text-subtle transition-colors hover:bg-surface-hover hover:text-fg">
                          <MoreVertical className="size-4" aria-hidden />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                          {person.isBlocked ? (
                            <DropdownMenuItem onSelect={() => onRequestToggleBlock(person)}>
                              <ShieldCheck className="size-4" aria-hidden />
                              Unblock
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem onSelect={() => onRequestToggleBlock(person)} destructive>
                              <Ban className="size-4" aria-hidden />
                              Block
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {data ? (
            <div className="mt-1">
              <Pagination meta={data.meta} onPageChange={onPageChange} />
            </div>
          ) : null}
        </>
      )}
    </div>
  );
};

export const StaffPage = () => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [toggling, setToggling] = useState<AdminUser | null>(null);
  const { data: currentUser } = useCurrentUser();

  // Each role's page lives in the URL (not useState) so a reload lands back
  // on the same page instead of resetting.
  const [searchParams, setSearchParams] = useSearchParams();
  const teacherPage = Number(searchParams.get('teacherPage')) || 1;
  const adminPage = Number(searchParams.get('adminPage')) || 1;

  const setRolePage = (key: 'teacherPage' | 'adminPage', next: number) => {
    setSearchParams((prev) => {
      const params = new URLSearchParams(prev);
      if (next > 1) params.set(key, String(next));
      else params.delete(key);
      return params;
    });
  };

  const { data: teachers, isLoading: teachersLoading } = useUsers({ role: 'teacher', page: teacherPage, limit: 20 });
  const { data: admins, isLoading: adminsLoading } = useUsers({ role: 'admin', page: adminPage, limit: 20 });
  const { mutateAsync, isPending, error, reset } = useCreateStaff();
  const toggleBlock = useToggleBlockUser();

  const {
    register: field,
    handleSubmit,
    control,
    reset: resetForm,
    formState: { errors },
  } = useForm<CreateStaffInput>({ resolver: zodResolver(createStaffSchema) });

  const closeDialog = () => {
    setDialogOpen(false);
    resetForm();
    reset();
  };

  const onSubmit = handleSubmit(async (values) => {
    const created = await mutateAsync(values);
    toast.success(`Invited ${created.name} — they'll get an email to set their password`);
    closeDialog();
  });

  const confirmToggleBlock = async () => {
    if (!toggling) return;
    await toggleBlock.mutateAsync(toggling.id);
    toast.success(toggling.isBlocked ? `${toggling.name} unblocked` : `${toggling.name} blocked`);
    setToggling(null);
  };

  return (
    <AppShell>
      <PageHeader
        title="Staff"
        description="Teacher and admin accounts. There's no self-registration for staff — invite them here."
        actions={
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="size-4" aria-hidden />
            Invite staff
          </Button>
        }
      />

      {!teachersLoading && !adminsLoading && (teachers?.meta.totalItems ?? 0) === 0 && (admins?.meta.totalItems ?? 0) === 0 ? (
        <EmptyState
          icon={UserCog}
          title="No staff yet"
          description="Invite your first teacher or admin — they'll get an email to set their password."
          action={<Button onClick={() => setDialogOpen(true)}>Invite staff</Button>}
        />
      ) : (
        <div className="flex flex-col gap-8">
          <StaffTable
            title="Teachers"
            data={teachers}
            isLoading={teachersLoading}
            currentUserId={currentUser?.id}
            onPageChange={(p) => setRolePage('teacherPage', p)}
            onRequestToggleBlock={setToggling}
          />
          <StaffTable
            title="Admins"
            data={admins}
            isLoading={adminsLoading}
            currentUserId={currentUser?.id}
            onPageChange={(p) => setRolePage('adminPage', p)}
            onRequestToggleBlock={setToggling}
          />
        </div>
      )}

      <ConfirmDialog
        open={Boolean(toggling)}
        onOpenChange={(open) => !open && setToggling(null)}
        title={toggling?.isBlocked ? `Unblock ${toggling.name}?` : `Block ${toggling?.name}?`}
        description={
          toggling?.isBlocked
            ? 'They will regain the ability to sign in.'
            : 'They will be signed out and unable to sign back in until unblocked. Their account and academic record are untouched.'
        }
        confirmLabel={toggling?.isBlocked ? 'Unblock' : 'Block'}
        destructive={!toggling?.isBlocked}
        loading={toggleBlock.isPending}
        onConfirm={confirmToggleBlock}
      />

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => (open ? setDialogOpen(true) : closeDialog())}
        title="Invite staff"
        description="They'll get an email with a link to set their own password. You never see or set it for them."
      >
        <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
          {error instanceof ApiError ? <Alert>{error.message}</Alert> : null}

          <Field label="Full name" htmlFor="name" error={errors.name?.message}>
            <Input id="name" {...field('name')} />
          </Field>

          <Field label="Email" htmlFor="email" error={errors.email?.message}>
            <Input id="email" type="email" {...field('email')} />
          </Field>

          <Field label="Role" htmlFor="role" error={errors.role?.message}>
            <Controller
              control={control}
              name="role"
              render={({ field: selectField }) => (
                <Select
                  id="role"
                  options={roleOptions}
                  value={selectField.value}
                  onValueChange={selectField.onChange}
                  invalid={Boolean(errors.role)}
                  placeholder="Select a role"
                />
              )}
            />
          </Field>

          <div className="mt-2 flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={closeDialog}>
              Cancel
            </Button>
            <Button type="submit" loading={isPending}>
              <Mail className="size-4" aria-hidden />
              Send invite
            </Button>
          </div>
        </form>
      </Dialog>
    </AppShell>
  );
};
