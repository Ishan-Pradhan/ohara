import { useMutation, useQuery } from '@tanstack/react-query';

import { fetchAtRiskDashboard, explainAtRisk } from './atRisk.api.js';

export const atRiskKey = (courseId: string) => ['atRisk', courseId] as const;

export const useAtRiskDashboard = (courseId: string) =>
  useQuery({ queryKey: atRiskKey(courseId), queryFn: () => fetchAtRiskDashboard(courseId), enabled: Boolean(courseId) });

export const useExplainAtRisk = (courseId: string) =>
  useMutation({ mutationFn: (studentId: string) => explainAtRisk(courseId, studentId) });
