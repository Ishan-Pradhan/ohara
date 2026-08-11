import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate } from 'react-router-dom';

import {
  registerSchema,
  type RegisterInput,
} from '../../schemas/auth.schema.js';
import { useRegister } from './useAuth.js';
import { useInstitutionProfile } from '../institution/useInstitution.js';
import { ApiError } from '../../lib/apiError.js';
import { AuthLayout } from '../../components/AuthLayout.js';
import { Button } from '../../components/ui/Button.js';
import { Input } from '../../components/ui/Input.js';
import { PasswordInput } from '../../components/ui/PasswordInput.js';
import { Field } from '../../components/ui/Field.js';
import { Alert } from '../../components/ui/Alert.js';

export const RegisterPage = () => {
  const navigate = useNavigate();
  const { mutateAsync, isPending, error } = useRegister();
  const { data: institution } = useInstitutionProfile();

  const {
    register: field,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<RegisterInput>({ resolver: zodResolver(registerSchema) });

  const onSubmit = handleSubmit(async (values) => {
    try {
      await mutateAsync(values);
      navigate('/verify-email-sent', { replace: true });
    } catch (caught) {
      if (caught instanceof ApiError) {
        for (const [name, message] of Object.entries(caught.fieldErrors)) {
          setError(name as keyof RegisterInput, { message });
        }
      }
    }
  });

  return (
    <AuthLayout
      eyebrow="New registration"
      title="Create your account"
      footer={
        <>
          Already registered?{' '}
          <Link to="/login" className="font-medium text-primary hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        {error instanceof ApiError ? <Alert>{error.message}</Alert> : null}

        <Field label="Full name" htmlFor="name" error={errors.name?.message}>
          <Input
            id="name"
            autoComplete="name"
            invalid={Boolean(errors.name)}
            {...field('name')}
          />
        </Field>

        <Field
          label="Email"
          htmlFor="email"
          error={errors.email?.message}
          hint={
            !errors.email && institution?.allowedEmailDomain
              ? `Use your @${institution.allowedEmailDomain} email`
              : undefined
          }
        >
          <Input
            id="email"
            type="email"
            autoComplete="email"
            invalid={Boolean(errors.email)}
            {...field('email')}
          />
        </Field>

        <Field
          label="Password"
          htmlFor="password"
          error={errors.password?.message}
          hint={errors.password ? undefined : 'At least 6 characters'}
        >
          <PasswordInput
            id="password"
            autoComplete="new-password"
            invalid={Boolean(errors.password)}
            {...field('password')}
          />
        </Field>

        <Field label="Date of birth (optional)" htmlFor="dateOfBirth">
          <Input id="dateOfBirth" type="date" {...field('dateOfBirth')} />
        </Field>

        <Button type="submit" loading={isPending}>
          Create account
        </Button>
      </form>
    </AuthLayout>
  );
};
