import { useQuery } from '@tanstack/react-query';

import { fetchStudentDashboard } from './dashboard.api.js';

export const studentDashboardKey = ['studentDashboard'] as const;

export const useStudentDashboard = (enabled: boolean) =>
  useQuery({
    queryKey: studentDashboardKey,
    queryFn: fetchStudentDashboard,
    enabled,
  });
