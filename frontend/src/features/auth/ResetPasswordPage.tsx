import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useSearchParams } from 'react-router-dom';

import {
  resetPasswordSchema,
  type ResetPasswordInput,
} from '../../schemas/auth.schema.js';
import { useResetPassword } from './useAuth.js';
import { ApiError } from '../../lib/apiError.js';
import { AuthLayout } from '../../components/AuthLayout.js';
import { Button } from '../../components/ui/Button.js';
import { PasswordInput } from '../../components/ui/PasswordInput.js';
import { Field } from '../../components/ui/Field.js';
import { Alert } from '../../components/ui/Alert.js';

export const ResetPasswordPage = () => {
  const [params] = useSearchParams();
  const token = params.get('token');

  const { mutateAsync, isPending, isSuccess, error } = useResetPassword(token ?? '');

  const {
    register: field,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetPasswordInput>({ resolver: zodResolver(resetPasswordSchema) });

  // Failure is surfaced via `error` from useMutation (rendered below), not
  // caught here — the empty handler just prevents an unhandled rejection.
  const onSubmit = handleSubmit((values) => {
    mutateAsync(values).catch(() => undefined);
  });

  if (!token) {
    return (
      <AuthLayout
        eyebrow="Password reset"
        title="Reset your password"
        footer={
          <Link to="/forgot-password" className="font-medium text-primary hover:underline">
            Request a new link
          </Link>
        }
      >
        <Alert>This reset link is missing its token. Request a new one below.</Alert>
      </AuthLayout>
    );
  }

  if (isSuccess) {
    return (
      <AuthLayout
        eyebrow="All set"
        title="Password reset"
        footer={
          <Link to="/login" className="font-medium text-primary hover:underline">
            Sign in
          </Link>
        }
      >
        <Alert variant="success">
          Your password has been reset. You can sign in with your new password now.
        </Alert>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      eyebrow="Choose a new password"
      title="Reset your password"
      footer={
        <Link to="/login" className="font-medium text-primary hover:underline">
          Back to sign in
        </Link>
      }
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        {error instanceof ApiError ? (
          <Alert>
            {error.message}{' '}
            <Link to="/forgot-password" className="font-medium underline">
              Request a new link
            </Link>
          </Alert>
        ) : null}

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

        <Button type="submit" loading={isPending}>
          Reset password
        </Button>
      </form>
    </AuthLayout>
  );
};
