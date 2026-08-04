import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Mail, Plus, UserCog } from 'lucide-react';

import { createStaffSchema, type CreateStaffInput } from '../../features/users/users.schema.js';
import { useCreateStaff, useUsers } from '../../features/users/useUsers.js';
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
import { Dialog } from '../../components/ui/Dialog.js';
import { Alert } from '../../components/ui/Alert.js';
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

export const StaffPage = () => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const { data: teachers, isLoading: teachersLoading } = useUsers({ role: 'teacher', limit: 100 });
  const { data: admins, isLoading: adminsLoading } = useUsers({ role: 'admin', limit: 100 });
  const { mutateAsync, isPending, error, reset } = useCreateStaff();

  const {
    register: field,
    handleSubmit,
    control,
    reset: resetForm,
    formState: { errors },
  } = useForm<CreateStaffInput>({ resolver: zodResolver(createStaffSchema) });

  const isLoading = teachersLoading || adminsLoading;
  const staff = [...(teachers?.items ?? []), ...(admins?.items ?? [])].sort((a, b) =>
    a.name.localeCompare(b.name),
  );

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

      {isLoading ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : staff.length === 0 ? (
        <EmptyState
          icon={UserCog}
          title="No staff yet"
          description="Invite your first teacher or admin — they'll get an email to set their password."
          action={<Button onClick={() => setDialogOpen(true)}>Invite staff</Button>}
        />
      ) : (
        <Table>
          <TableHead>
            <TableRow>
              <TableHeadCell>Name</TableHeadCell>
              <TableHeadCell>Role</TableHeadCell>
              <TableHeadCell>Status</TableHeadCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {staff.map((person) => (
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
                  <Badge variant={person.role === 'admin' ? 'primary' : 'accent'}>
                    {person.role === 'admin' ? 'Admin' : 'Teacher'}
                  </Badge>
                </TableCell>
                <TableCell>
                  {person.isVerified ? (
                    <Badge variant="success">Active</Badge>
                  ) : (
                    <Badge>Invite pending</Badge>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

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
