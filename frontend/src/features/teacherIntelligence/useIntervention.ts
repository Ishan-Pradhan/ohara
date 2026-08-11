import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  fetchInterventions,
  createIntervention,
  generateIntervention,
  resolveIntervention,
  deleteIntervention,
  fetchInterventionOutcome,
} from './intervention.api.js';
import type { CreateInterventionInput } from './intervention.schema.js';

export const interventionsKey = (courseId: string) => ['interventions', courseId] as const;

export const useInterventions = (courseId: string, studentId?: string) =>
  useQuery({
    queryKey: studentId ? [...interventionsKey(courseId), studentId] : interventionsKey(courseId),
    queryFn: () => fetchInterventions(courseId, studentId),
    enabled: Boolean(courseId),
  });

export const useCreateIntervention = (courseId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateInterventionInput) => createIntervention(courseId, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: interventionsKey(courseId) }),
  });
};

export const useGenerateIntervention = (courseId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (studentId: string) => generateIntervention(courseId, studentId),
    onSuccess: () => qc.invalidateQueries({ queryKey: interventionsKey(courseId) }),
  });
};

export const useResolveIntervention = (courseId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => resolveIntervention(courseId, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: interventionsKey(courseId) }),
  });
};

export const useDeleteIntervention = (courseId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteIntervention(courseId, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: interventionsKey(courseId) }),
  });
};

export const useInterventionOutcome = (courseId: string, id: string) =>
  useQuery({
    queryKey: [...interventionsKey(courseId), 'outcome', id],
    queryFn: () => fetchInterventionOutcome(courseId, id),
    enabled: Boolean(courseId) && Boolean(id),
  });
