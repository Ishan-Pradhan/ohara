import type { ReactElement } from 'react';
import { createBrowserRouter } from 'react-router-dom';

import { LoginPage } from './features/auth/LoginPage.js';
import { RegisterPage } from './features/auth/RegisterPage.js';
import { ForgotPasswordPage } from './features/auth/ForgotPasswordPage.js';
import { ResetPasswordPage } from './features/auth/ResetPasswordPage.js';
import { VerifyEmailPage } from './features/auth/VerifyEmailPage.js';
import { VerifyEmailSentPage } from './features/auth/VerifyEmailSentPage.js';
import { DashboardPage } from './pages/DashboardPage.js';
import { ForbiddenPage } from './pages/ForbiddenPage.js';
import { NotFoundPage } from './pages/NotFoundPage.js';
import { ErrorPage } from './pages/ErrorPage.js';
import { AcademicYearsPage } from './pages/admin/AcademicYearsPage.js';
import { ProgramsExplorerPage } from './pages/admin/structure/ProgramsExplorerPage.js';
import { ClassesExplorerPage } from './pages/admin/structure/ClassesExplorerPage.js';
import { ClassDetailPage } from './pages/admin/structure/ClassDetailPage.js';
import { CourseContentPage } from './pages/admin/course-content/CourseContentPage.js';
import { StudentsPage } from './pages/admin/StudentsPage.js';
import { AdmitStudentPage } from './pages/admin/AdmitStudentPage.js';
import { StudentDetailPage } from './pages/admin/StudentDetailPage.js';
import { StaffPage } from './pages/admin/StaffPage.js';
import { SettingsPage } from './pages/admin/SettingsPage.js';
import { ProtectedRoute } from './components/ProtectedRoute.js';

const adminRoute = (path: string, element: ReactElement) => ({
  path,
  element: <ProtectedRoute roles={['admin']}>{element}</ProtectedRoute>,
  errorElement: <ErrorPage />,
});

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage />, errorElement: <ErrorPage /> },
  { path: '/register', element: <RegisterPage />, errorElement: <ErrorPage /> },
  { path: '/forgot-password', element: <ForgotPasswordPage />, errorElement: <ErrorPage /> },
  { path: '/reset-password', element: <ResetPasswordPage />, errorElement: <ErrorPage /> },
  { path: '/verify-email', element: <VerifyEmailPage />, errorElement: <ErrorPage /> },
  { path: '/verify-email-sent', element: <VerifyEmailSentPage />, errorElement: <ErrorPage /> },
  { path: '/forbidden', element: <ForbiddenPage />, errorElement: <ErrorPage /> },
  {
    path: '/',
    element: (
      <ProtectedRoute>
        <DashboardPage />
      </ProtectedRoute>
    ),
    errorElement: <ErrorPage />,
  },
  adminRoute('/admin/academic-years', <AcademicYearsPage />),
  adminRoute('/admin/structure', <ProgramsExplorerPage />),
  adminRoute('/admin/structure/:programId', <ClassesExplorerPage />),
  adminRoute('/admin/structure/:programId/:classId', <ClassDetailPage />),
  adminRoute('/admin/courses/:courseId', <CourseContentPage />),
  adminRoute('/admin/students', <StudentsPage />),
  adminRoute('/admin/students/admit', <AdmitStudentPage />),
  adminRoute('/admin/students/:studentId', <StudentDetailPage />),
  adminRoute('/admin/staff', <StaffPage />),
  adminRoute('/admin/settings', <SettingsPage />),
  { path: '*', element: <NotFoundPage /> },
]);
