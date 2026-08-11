import { Navigate, useParams } from 'react-router-dom';

export const TeacherCourseRedirect = () => {
  const { courseId = '' } = useParams();
  return <Navigate to={`/teacher/courses/${courseId}/overview`} replace />;
};
