import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';

import { useCurrentUser } from '../features/auth/useAuth.js';
import { Spinner } from './ui/Spinner.js';

interface GuestOnlyRouteProps {
  children: ReactNode;
}

/** The inverse of ProtectedRoute — login/register/forgot-password/reset-password
 * only make sense for a signed-out visitor. An already-authenticated user
 * landing here (e.g. a stale bookmark, or navigating back) gets sent home
 * instead of seeing the login form again. */
export const GuestOnlyRoute = ({ children }: GuestOnlyRouteProps) => {
  const { data: user, isPending } = useCurrentUser();

  if (isPending) {
    return (
      <div className="min-h-dvh grid place-items-center">
        <Spinner />
      </div>
    );
  }

  if (user) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};
