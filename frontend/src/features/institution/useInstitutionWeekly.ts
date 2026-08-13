import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchInstitutionWeekly, generateInstitutionWeeklyInsights } from './institutionWeekly.api.js';

const institutionWeeklyKey = ['institutionWeekly'] as const;

export const useInstitutionWeekly = () =>
  useQuery({
    queryKey: institutionWeeklyKey,
    queryFn: fetchInstitutionWeekly,
  });

/** Admin-triggered only. Patches the cached query directly with the fresh
 * insights on success — no need to refetch the whole week's data just to
 * pick up a new insights paragraph. */
export const useGenerateInstitutionWeeklyInsights = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: generateInstitutionWeeklyInsights,
    onSuccess: ({ insights, generatedAt }) => {
      qc.setQueryData(
        institutionWeeklyKey,
        (prev: Awaited<ReturnType<typeof fetchInstitutionWeekly>> | undefined) =>
          prev ? { ...prev, insights, insightsGeneratedAt: generatedAt } : prev,
      );
    },
  });
};
