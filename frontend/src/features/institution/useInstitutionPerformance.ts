import { useQuery } from '@tanstack/react-query';
import { fetchInstitutionPerformance } from './institutionPerformance.api.js';

const institutionPerformanceKey = ['institutionPerformance'] as const;

export const useInstitutionPerformance = () =>
  useQuery({
    queryKey: institutionPerformanceKey,
    queryFn: fetchInstitutionPerformance,
  });
