import { useCurrentUser } from '../auth/useAuth.js';
import { useCourses } from '../institution/useInstitution.js';
import { useMyCourses } from '../teacher/useTeacher.js';
import { useStudentPlacement } from '../placement/usePlacement.js';

export interface AccessibleCourse {
  id: string;
  title: string;
  code: string;
}

/** The set of courses a top-level (non-course-scoped) page should let the
 * caller pick from — admin: every course; teacher: courses they're
 * assigned to; student: courses from their current placement. One hook so
 * Gradebook/Attendance/At-Risk/Projects pages don't each re-derive this
 * role branch. */
export const useAccessibleCourses = (): { courses: AccessibleCourse[]; isLoading: boolean } => {
  const { data: user } = useCurrentUser();
  const role = user?.role;

  const admin = useCourses(role === 'admin');
  const teacher = useMyCourses(role === 'teacher');
  const student = useStudentPlacement(role === 'student' ? (user?.id ?? '') : '');

  if (role === 'admin') {
    return { courses: admin.data ?? [], isLoading: admin.isLoading };
  }
  if (role === 'teacher') {
    return { courses: teacher.data ?? [], isLoading: teacher.isLoading };
  }
  if (role === 'student') {
    return { courses: student.data?.courses ?? [], isLoading: student.isLoading };
  }
  return { courses: [], isLoading: false };
};
