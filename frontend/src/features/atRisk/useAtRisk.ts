import { useMutation, useQuery } from '@tanstack/react-query';

import { fetchAtRiskDashboard, explainAtRisk } from './atRisk.api.js';

export const atRiskKey = (courseId: string, sectionId?: string) => ['atRisk', courseId, sectionId] as const;

export const useAtRiskDashboard = (courseId: string, sectionId?: string) =>
  useQuery({ queryKey: atRiskKey(courseId, sectionId), queryFn: () => fetchAtRiskDashboard(courseId, sectionId), enabled: Boolean(courseId) });

export const useExplainAtRisk = (courseId: string) =>
  useMutation({ mutationFn: (studentId: string) => explainAtRisk(courseId, studentId) });
