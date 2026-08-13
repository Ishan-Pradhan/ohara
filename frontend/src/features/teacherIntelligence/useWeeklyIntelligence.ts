import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchWeeklySummary, generateWeeklySummaryInsights } from './weeklyIntelligence.api.js';

const weeklyIntelligenceKey = (courseId: string) => ['teacherWeeklyIntelligence', courseId] as const;

export const useWeeklySummary = (courseId: string) =>
  useQuery({
    queryKey: weeklyIntelligenceKey(courseId),
    queryFn: () => fetchWeeklySummary(courseId),
    enabled: Boolean(courseId),
  });

/** Teacher-triggered only. Patches the cached query directly with the fresh
 * insights on success — no need to refetch the whole week's data just to
 * pick up a new insights paragraph. */
export const useGenerateWeeklySummaryInsights = (courseId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => generateWeeklySummaryInsights(courseId),
    onSuccess: ({ insights, generatedAt }) => {
      qc.setQueryData(
        weeklyIntelligenceKey(courseId),
        (prev: Awaited<ReturnType<typeof fetchWeeklySummary>> | undefined) =>
          prev ? { ...prev, insights, insightsGeneratedAt: generatedAt } : prev,
      );
    },
  });
};
