import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';

import { loginSchema, type LoginInput } from '../../schemas/auth.schema.js';
import { useLogin } from './useAuth.js';
import { ApiError } from '../../lib/apiError.js';
import { AuthLayout } from '../../components/AuthLayout.js';
import { Button } from '../../components/ui/Button.js';
import { Input } from '../../components/ui/Input.js';
import { Field } from '../../components/ui/Field.js';
import { Alert } from '../../components/ui/Alert.js';

export const LoginPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  // The backend redirects here with ?error= when an OAuth sign-in is refused.
  const oauthError = params.get('error');
  const { mutateAsync, isPending, error } = useLogin();

  const {
    register: field,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });

  const from = (location.state as { from?: string } | null)?.from ?? '/';

  const onSubmit = handleSubmit(async (values) => {
    try {
      await mutateAsync(values);
      navigate(from, { replace: true });
    } catch (caught) {
      if (caught instanceof ApiError) {
        for (const [name, message] of Object.entries(caught.fieldErrors)) {
          setError(name as keyof LoginInput, { message });
        }
      }
    }
  });

  const banner = oauthError ?? (error instanceof ApiError ? error.message : null);

  return (
    <AuthLayout
      title="Sign in"
      subtitle="Your institution's learning portal"
      footer={
        <>
          No account?{' '}
          <Link to="/register" className="text-primary underline">
            Register
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        {banner ? <Alert>{banner}</Alert> : null}

        <Field label="Email" htmlFor="email" error={errors.email?.message}>
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
        >
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            invalid={Boolean(errors.password)}
            {...field('password')}
          />
        </Field>

        <Button type="submit" loading={isPending}>
          Sign in
        </Button>

        <div className="flex items-center gap-3 my-1">
          <span className="h-px flex-1 bg-border" />
          <span className="text-xs text-muted">or</span>
          <span className="h-px flex-1 bg-border" />
        </div>

        {/*
          Plain anchors, not fetch calls: OAuth is a full-page redirect chain
          the browser has to follow.
        */}
        <div className="flex gap-3">
          <a href="/api/v1/auth/google" className="flex-1">
            <Button type="button" variant="ghost" className="w-full">
              Google
            </Button>
          </a>
          <a href="/api/v1/auth/github" className="flex-1">
            <Button type="button" variant="ghost" className="w-full">
              GitHub
            </Button>
          </a>
        </div>
      </form>
    </AuthLayout>
  );
};
