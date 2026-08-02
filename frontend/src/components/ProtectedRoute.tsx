import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';

import { useCurrentUser } from '../features/auth/useAuth.js';
import { Spinner } from './ui/Spinner.js';
import type { CurrentUser } from '../schemas/auth.schema.js';

interface ProtectedRouteProps {
  children: ReactNode;
  roles?: CurrentUser['role'][];
}

export const ProtectedRoute = ({ children, roles }: ProtectedRouteProps) => {
  const location = useLocation();
  const { data: user, isPending, isError } = useCurrentUser();

  if (isPending) {
    return (
      <div className="min-h-dvh grid place-items-center">
        <Spinner />
      </div>
    );
  }

  // The server is the authority. This only decides what to render — every
  // protected route is enforced again on the backend.
  if (isError || !user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (roles && !roles.includes(user.role)) {
    return <Navigate to="/forbidden" replace />;
  }

  return <>{children}</>;
};
