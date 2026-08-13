import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  fetchInstitutionPerformance,
  generateInstitutionPerformanceInsights,
} from './institutionPerformance.api.js';

const institutionPerformanceKey = ['institutionPerformance'] as const;

export const useInstitutionPerformance = () =>
  useQuery({
    queryKey: institutionPerformanceKey,
    queryFn: fetchInstitutionPerformance,
  });

/** Admin-triggered only. Patches the cached query directly with the fresh
 * insights on success — no need to refetch the whole page (stats/programs/
 * courses) just to pick up a new insights paragraph. */
export const useGenerateInstitutionPerformanceInsights = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: generateInstitutionPerformanceInsights,
    onSuccess: ({ insights, generatedAt }) => {
      qc.setQueryData(
        institutionPerformanceKey,
        (prev: Awaited<ReturnType<typeof fetchInstitutionPerformance>> | undefined) =>
          prev ? { ...prev, insights, insightsGeneratedAt: generatedAt } : prev,
      );
    },
  });
};
