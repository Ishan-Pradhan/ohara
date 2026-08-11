import type { ReactElement } from 'react';
import { createBrowserRouter } from 'react-router-dom';

import { LoginPage } from './features/auth/LoginPage.js';
import { RegisterPage } from './features/auth/RegisterPage.js';
import { ForgotPasswordPage } from './features/auth/ForgotPasswordPage.js';
import { ResetPasswordPage } from './features/auth/ResetPasswordPage.js';
import { VerifyEmailPage } from './features/auth/VerifyEmailPage.js';
import { VerifyEmailSentPage } from './features/auth/VerifyEmailSentPage.js';
import { DashboardPage } from './pages/DashboardPage.js';
import { CalendarPage } from './pages/CalendarPage.js';
import { GradebookPage } from './pages/GradebookPage.js';
import { AttendancePage } from './pages/AttendancePage.js';
import { AtRiskPage } from './pages/AtRiskPage.js';
import { TranscriptPage } from './pages/TranscriptPage.js';
import { ForbiddenPage } from './pages/ForbiddenPage.js';
import { NotFoundPage } from './pages/NotFoundPage.js';
import { ErrorPage } from './pages/ErrorPage.js';
import { AcademicYearsPage } from './pages/admin/AcademicYearsPage.js';
import { ProgramsExplorerPage } from './pages/admin/structure/ProgramsExplorerPage.js';
import { ClassesExplorerPage } from './pages/admin/structure/ClassesExplorerPage.js';
import { ClassDetailPage } from './pages/admin/structure/ClassDetailPage.js';
import { CourseContentPage } from './pages/admin/course-content/CourseContentPage.js';
import { AssignmentDetailPage } from './pages/admin/course-content/AssignmentDetailPage.js';
import { QuizDetailPage } from './pages/admin/course-content/QuizDetailPage.js';
import { LessonViewPage } from './pages/admin/course-content/LessonViewPage.js';
import { StudentsPage } from './pages/admin/StudentsPage.js';
import { AdmitStudentPage } from './pages/admin/AdmitStudentPage.js';
import { StudentDetailPage } from './pages/admin/StudentDetailPage.js';
import { StaffPage } from './pages/admin/StaffPage.js';
import { SettingsPage } from './pages/admin/SettingsPage.js';
import { AdminAnalyticsPage } from './pages/admin/AdminAnalyticsPage.js';
import { MyCoursesPage } from './pages/teacher/MyCoursesPage.js';
import { TeacherCoursePage } from './pages/teacher/TeacherCoursePage.js';
import { CourseStudentsPage } from './pages/teacher/CourseStudentsPage.js';
import { MySectionPage } from './pages/teacher/MySectionPage.js';
import { StudentCoursesPage } from './pages/student/StudentCoursesPage.js';
import { StudentCoursePage } from './pages/student/StudentCoursePage.js';
import { StudentAssignmentDetailPage } from './pages/student/StudentAssignmentDetailPage.js';
import { QuizTakePage } from './pages/student/QuizTakePage.js';
import { StudentLessonPage } from './pages/student/StudentLessonPage.js';
import { StudentProgressPage } from './pages/student/StudentProgressPage.js';
import { StudentProfilePage } from './pages/student/StudentProfilePage.js';
import { ProtectedRoute } from './components/ProtectedRoute.js';
import { GuestOnlyRoute } from './components/GuestOnlyRoute.js';

const adminRoute = (path: string, element: ReactElement) => ({
  path,
  element: <ProtectedRoute roles={['admin']}>{element}</ProtectedRoute>,
  errorElement: <ErrorPage />,
});

const teacherRoute = (path: string, element: ReactElement) => ({
  path,
  element: <ProtectedRoute roles={['teacher']}>{element}</ProtectedRoute>,
  errorElement: <ErrorPage />,
});

const studentRoute = (path: string, element: ReactElement) => ({
  path,
  element: <ProtectedRoute roles={['student']}>{element}</ProtectedRoute>,
  errorElement: <ErrorPage />,
});

const guestRoute = (path: string, element: ReactElement) => ({
  path,
  element: <GuestOnlyRoute>{element}</GuestOnlyRoute>,
  errorElement: <ErrorPage />,
});

export const router = createBrowserRouter([
  guestRoute('/login', <LoginPage />),
  guestRoute('/register', <RegisterPage />),
  guestRoute('/forgot-password', <ForgotPasswordPage />),
  guestRoute('/reset-password', <ResetPasswordPage />),
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
  {
    path: '/calendar',
    element: (
      <ProtectedRoute>
        <CalendarPage />
      </ProtectedRoute>
    ),
    errorElement: <ErrorPage />,
  },
  {
    path: '/gradebook',
    element: (
      <ProtectedRoute>
        <GradebookPage />
      </ProtectedRoute>
    ),
    errorElement: <ErrorPage />,
  },
  {
    path: '/attendance',
    element: (
      <ProtectedRoute>
        <AttendancePage />
      </ProtectedRoute>
    ),
    errorElement: <ErrorPage />,
  },
  {
    path: '/at-risk',
    element: <ProtectedRoute roles={['admin', 'teacher']}><AtRiskPage /></ProtectedRoute>,
    errorElement: <ErrorPage />,
  },
  {
    path: '/transcripts',
    element: (
      <ProtectedRoute>
        <TranscriptPage />
      </ProtectedRoute>
    ),
    errorElement: <ErrorPage />,
  },
  adminRoute('/admin/academic-years', <AcademicYearsPage />),
  adminRoute('/admin/structure', <ProgramsExplorerPage />),
  adminRoute('/admin/structure/:programId', <ClassesExplorerPage />),
  adminRoute('/admin/structure/:programId/:classId', <ClassDetailPage />),
  {
    path: '/admin/courses/:courseId',
    element: <ProtectedRoute roles={['admin', 'teacher']}><CourseContentPage /></ProtectedRoute>,
    errorElement: <ErrorPage />,
  },
  {
    path: '/admin/courses/:courseId/assignments/:assignmentId',
    element: <ProtectedRoute roles={['admin', 'teacher']}><AssignmentDetailPage /></ProtectedRoute>,
    errorElement: <ErrorPage />,
  },
  {
    path: '/admin/courses/:courseId/quizzes/:quizId',
    element: <ProtectedRoute roles={['admin', 'teacher']}><QuizDetailPage /></ProtectedRoute>,
    errorElement: <ErrorPage />,
  },
  {
    path: '/admin/courses/:courseId/lessons/:lessonId',
    element: <ProtectedRoute roles={['admin', 'teacher']}><LessonViewPage /></ProtectedRoute>,
    errorElement: <ErrorPage />,
  },
  adminRoute('/admin/students', <StudentsPage />),
  adminRoute('/admin/students/admit', <AdmitStudentPage />),
  adminRoute('/admin/students/:studentId', <StudentDetailPage />),
  adminRoute('/admin/staff', <StaffPage />),
  adminRoute('/admin/settings', <SettingsPage />),
  adminRoute('/admin/analytics', <AdminAnalyticsPage />),
  teacherRoute('/teacher/courses', <MyCoursesPage />),
  teacherRoute('/teacher/courses/:courseId', <TeacherCoursePage />),
  teacherRoute('/teacher/courses/:courseId/students', <CourseStudentsPage />),
  teacherRoute('/teacher/section', <MySectionPage />),
  studentRoute('/student/courses', <StudentCoursesPage />),
  studentRoute('/student/progress', <StudentProgressPage />),
  studentRoute('/student/profile', <StudentProfilePage />),
  studentRoute('/student/courses/:courseId', <StudentCoursePage />),
  studentRoute('/student/courses/:courseId/assignments/:assignmentId', <StudentAssignmentDetailPage />),
  studentRoute('/student/courses/:courseId/quizzes/:quizId', <QuizTakePage />),
  studentRoute('/student/courses/:courseId/lessons/:lessonId', <StudentLessonPage />),
  { path: '*', element: <NotFoundPage /> },
]);
