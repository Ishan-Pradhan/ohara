import { createBrowserRouter } from 'react-router-dom';

import { LoginPage } from './features/auth/LoginPage.js';
import { RegisterPage } from './features/auth/RegisterPage.js';
import { VerifyEmailPage } from './features/auth/VerifyEmailPage.js';
import { VerifyEmailSentPage } from './features/auth/VerifyEmailSentPage.js';
import { DashboardPage } from './pages/DashboardPage.js';
import { ForbiddenPage } from './pages/ForbiddenPage.js';
import { ProtectedRoute } from './components/ProtectedRoute.js';

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  { path: '/register', element: <RegisterPage /> },
  { path: '/verify-email', element: <VerifyEmailPage /> },
  { path: '/verify-email-sent', element: <VerifyEmailSentPage /> },
  { path: '/forbidden', element: <ForbiddenPage /> },
  {
    path: '/',
    element: (
      <ProtectedRoute>
        <DashboardPage />
      </ProtectedRoute>
    ),
  },
]);
