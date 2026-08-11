import { useQuery } from '@tanstack/react-query';
import { fetchInstitutionWeekly } from './institutionWeekly.api.js';

const institutionWeeklyKey = ['institutionWeekly'] as const;

export const useInstitutionWeekly = () =>
  useQuery({
    queryKey: institutionWeeklyKey,
    queryFn: fetchInstitutionWeekly,
  });
