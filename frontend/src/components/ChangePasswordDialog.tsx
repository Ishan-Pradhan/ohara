import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import { changePasswordSchema, type ChangePasswordInput } from '../schemas/auth.schema.js';
import { useChangePassword } from '../features/auth/useAuth.js';
import { ApiError } from '../lib/apiError.js';
import { toast } from '../lib/toast.js';
import { Dialog } from './ui/Dialog.js';
import { Button } from './ui/Button.js';
import { PasswordInput } from './ui/PasswordInput.js';
import { Field } from './ui/Field.js';
import { Alert } from './ui/Alert.js';

interface ChangePasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const ChangePasswordDialog = ({ open, onOpenChange }: ChangePasswordDialogProps) => {
  const changePassword = useChangePassword();

  const {
    register: field,
    handleSubmit,
    reset: resetForm,
    formState: { errors },
  } = useForm<ChangePasswordInput>({ resolver: zodResolver(changePasswordSchema) });

  const closeDialog = () => {
    onOpenChange(false);
    resetForm();
    changePassword.reset();
  };

  const onSubmit = handleSubmit(async (values) => {
    await changePassword.mutateAsync(values);
    toast.success('Password changed');
    closeDialog();
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => (next ? onOpenChange(true) : closeDialog())}
      title="Change password"
      description="Changing your password signs you out of any other active sessions."
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        {changePassword.error instanceof ApiError ? (
          <Alert>{changePassword.error.message}</Alert>
        ) : null}

        <Field label="Current password" htmlFor="currentPassword" error={errors.currentPassword?.message}>
          <PasswordInput
            id="currentPassword"
            autoComplete="current-password"
            invalid={Boolean(errors.currentPassword)}
            {...field('currentPassword')}
          />
        </Field>

        <Field
          label="New password"
          htmlFor="newPassword"
          error={errors.newPassword?.message}
          hint={errors.newPassword ? undefined : 'At least 6 characters'}
        >
          <PasswordInput
            id="newPassword"
            autoComplete="new-password"
            invalid={Boolean(errors.newPassword)}
            {...field('newPassword')}
          />
        </Field>

        <Field label="Confirm new password" htmlFor="confirmPassword" error={errors.confirmPassword?.message}>
          <PasswordInput
            id="confirmPassword"
            autoComplete="new-password"
            invalid={Boolean(errors.confirmPassword)}
            {...field('confirmPassword')}
          />
        </Field>

        <div className="mt-2 flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={closeDialog}>
            Cancel
          </Button>
          <Button type="submit" loading={changePassword.isPending}>
            Change password
          </Button>
        </div>
      </form>
    </Dialog>
  );
};
