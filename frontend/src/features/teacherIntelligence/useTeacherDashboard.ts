import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchTeacherDashboard, generateTeacherDashboardInsights } from './teacherDashboard.api.js';

const teacherDashboardKey = ['teacherDashboard'] as const;

export const useTeacherDashboard = () =>
  useQuery({
    queryKey: teacherDashboardKey,
    queryFn: fetchTeacherDashboard,
  });

/** Teacher-triggered only. Patches the cached dashboard query directly with
 * the fresh insights on success — no need to refetch the whole dashboard
 * (courses/stats) just to pick up a new insights paragraph. */
export const useGenerateTeacherDashboardInsights = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: generateTeacherDashboardInsights,
    onSuccess: ({ insights, generatedAt }) => {
      qc.setQueryData(teacherDashboardKey, (prev: Awaited<ReturnType<typeof fetchTeacherDashboard>> | undefined) =>
        prev ? { ...prev, insights, insightsGeneratedAt: generatedAt } : prev,
      );
    },
  });
};
