import { useMutation, useQuery } from '@tanstack/react-query';

import { fetchAtRiskDashboard, explainAtRisk } from './atRisk.api.js';

export const atRiskKey = (courseId: string, sectionId?: string, batchId?: string) =>
  ['atRisk', courseId, sectionId ?? null, batchId ?? null] as const;

export const useAtRiskDashboard = (courseId: string, sectionId?: string, batchId?: string) =>
  useQuery({
    queryKey: atRiskKey(courseId, sectionId, batchId),
    queryFn: () => fetchAtRiskDashboard(courseId, sectionId, batchId),
    enabled: Boolean(courseId),
  });

export const useExplainAtRisk = (courseId: string, batchId?: string) =>
  useMutation({ mutationFn: (studentId: string) => explainAtRisk(courseId, studentId, batchId) });
