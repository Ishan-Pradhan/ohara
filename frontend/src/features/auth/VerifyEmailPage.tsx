import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import { verifyEmail } from './auth.api.js';
import { ApiError } from '../../lib/apiError.js';
import { AuthLayout } from '../../components/AuthLayout.js';
import { Spinner } from '../../components/ui/Spinner.js';
import { Alert } from '../../components/ui/Alert.js';

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
      title="Email verification"
      subtitle="Confirming your address"
      footer={
        <Link to="/login" className="text-primary underline">
          Go to sign in
        </Link>
      }
    >
      {state === 'pending' ? (
        <div className="flex items-center gap-3 text-sm text-muted">
          <Spinner /> Verifying…
        </div>
      ) : null}
      {state === 'done' ? (
        <p className="text-sm text-fg">
          Your email is verified. You can sign in now.
        </p>
      ) : null}
      {state === 'failed' ? <Alert>{message}</Alert> : null}
    </AuthLayout>
  );
};
