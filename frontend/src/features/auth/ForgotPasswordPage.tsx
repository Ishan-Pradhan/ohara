import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from 'react-router-dom';
import { MailCheck } from 'lucide-react';

import {
  forgotPasswordSchema,
  type ForgotPasswordInput,
} from '../../schemas/auth.schema.js';
import { useForgotPassword } from './useAuth.js';
import { ApiError } from '../../lib/apiError.js';
import { AuthLayout } from '../../components/AuthLayout.js';
import { Button } from '../../components/ui/Button.js';
import { Input } from '../../components/ui/Input.js';
import { Field } from '../../components/ui/Field.js';
import { Alert } from '../../components/ui/Alert.js';

export const ForgotPasswordPage = () => {
  const [sentTo, setSentTo] = useState<string | null>(null);
  const { mutateAsync, isPending, error } = useForgotPassword();

  const {
    register: field,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordInput>({ resolver: zodResolver(forgotPasswordSchema) });

  const onSubmit = handleSubmit(async (values) => {
    await mutateAsync(values);
    setSentTo(values.email);
  });

  if (sentTo) {
    return (
      <AuthLayout
        eyebrow="Check your inbox"
        title="Reset link sent"
        footer={
          <Link to="/login" className="font-medium text-primary hover:underline">
            Back to sign in
          </Link>
        }
      >
        <Alert variant="info" icon={MailCheck}>
          If an account exists for <span className="font-medium">{sentTo}</span>, we've sent a
          link to reset the password. It expires shortly, so use it soon.
        </Alert>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      eyebrow="Password reset"
      title="Forgot your password?"
      footer={
        <>
          Remembered it?{' '}
          <Link to="/login" className="font-medium text-primary hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        {error instanceof ApiError ? <Alert>{error.message}</Alert> : null}

        <p className="text-sm text-muted">
          Enter the email on your account and we'll send you a link to reset your password.
        </p>

        <Field label="Email" htmlFor="email" error={errors.email?.message}>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            invalid={Boolean(errors.email)}
            {...field('email')}
          />
        </Field>

        <Button type="submit" loading={isPending}>
          Send reset link
        </Button>
      </form>
    </AuthLayout>
  );
};
