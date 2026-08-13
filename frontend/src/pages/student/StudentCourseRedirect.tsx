import { Navigate, useParams } from 'react-router-dom';

export const StudentCourseRedirect = () => {
  const { courseId = '' } = useParams();
  return <Navigate to={`/student/courses/${courseId}/content`} replace />;
};
