import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import { verifyEmail } from './auth.api.js';
import { ApiError } from '../../lib/apiError.js';
import { AuthLayout } from '../../components/AuthLayout.js';
import { Spinner } from '../../components/ui/Spinner.js';
import { Alert } from '../../components/ui/Alert.js';
import { Button } from '../../components/ui/Button.js';

type State = 'pending' | 'done' | 'failed';

export const VerifyEmailPage = () => {
  const [params] = useSearchParams();
  const token = params.get('token');
  const [state, setState] = useState<State>('pending');
  const [message, setMessage] = useState('');
  const attempted = useRef(false);

  useEffect(() => {
    // StrictMode runs effects twice in development and the backend consumes the
    // token on first use, so an unguarded effect would always report failure.
    if (attempted.current) return;
    attempted.current = true;

    if (!token) {
      setState('failed');
      setMessage('This verification link is missing its token.');
      return;
    }

    verifyEmail(token)
      .then(() => setState('done'))
      .catch((error: unknown) => {
        setState('failed');
        setMessage(
          error instanceof ApiError
            ? error.message
            : 'This verification link is invalid or has expired.',
        );
      });
  }, [token]);

  return (
    <AuthLayout
      eyebrow="Account verification"
      title="Confirming your email"
      footer={
        state === 'failed' ? (
          <Link to="/login" className="font-medium text-primary hover:underline">
            Go to sign in
          </Link>
        ) : (
          <span className="text-subtle">One moment…</span>
        )
      }
    >
      {state === 'pending' ? (
        <div className="flex items-center justify-center gap-3 py-4 text-sm text-muted">
          <Spinner /> Verifying your email…
        </div>
      ) : null}
      {state === 'done' ? (
        <div className="flex flex-col gap-4">
          <Alert variant="success">Your email is verified — your account is ready to go.</Alert>
          <Link to="/login" className="w-full">
            <Button type="button" className="w-full">
              Continue to sign in
            </Button>
          </Link>
        </div>
      ) : null}
      {state === 'failed' ? <Alert>{message}</Alert> : null}
    </AuthLayout>
  );
};
