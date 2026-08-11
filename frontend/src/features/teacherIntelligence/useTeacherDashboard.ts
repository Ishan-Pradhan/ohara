import { useQuery } from '@tanstack/react-query';
import { fetchTeacherDashboard } from './teacherDashboard.api.js';

const teacherDashboardKey = ['teacherDashboard'] as const;

export const useTeacherDashboard = () =>
  useQuery({
    queryKey: teacherDashboardKey,
    queryFn: fetchTeacherDashboard,
  });
