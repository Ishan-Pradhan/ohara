import { useQuery } from '@tanstack/react-query';

import { fetchExamPrep } from './examPrep.api.js';

export const examPrepKey = (
  assessmentType: 'quiz' | 'assignment' | null,
  assessmentId: string | null,
) => ['examPrep', assessmentType, assessmentId] as const;

export const useExamPrep = (
  assessmentType: 'quiz' | 'assignment' | null,
  assessmentId: string | null,
) =>
  useQuery({
    queryKey: examPrepKey(assessmentType, assessmentId),
    queryFn: () => fetchExamPrep(assessmentType!, assessmentId!),
    enabled: assessmentType !== null && assessmentId !== null,
    // Don't auto-refetch on window focus — this is an on-demand query
    staleTime: 2 * 60 * 1000,
  });
