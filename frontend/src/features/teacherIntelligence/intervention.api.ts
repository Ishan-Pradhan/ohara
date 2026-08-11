import { z } from 'zod';
import { api } from '../../lib/axios.js';
import {
  interventionSchema,
  type Intervention,
  type CreateInterventionInput,
} from './intervention.schema.js';

export const interventionOutcomeSchema = z.object({
  hasOutcome: z.boolean(),
  reason: z.string().optional(),
  interventionId: z.string().optional(),
  status: z.enum(['active', 'resolved', 'dismissed']).optional(),
  resolvedAt: z.string().nullable().optional(),
  metrics: z
    .object({
      averageGrade: z.object({ before: z.number().nullable(), after: z.number().nullable(), change: z.number(), trend: z.enum(['improved', 'declined', 'stable']) }),
      attendancePercentage: z.object({ before: z.number().nullable(), after: z.number().nullable(), change: z.number(), trend: z.enum(['improved', 'declined', 'stable']) }),
      missingSubmissions: z.object({ before: z.number(), after: z.number(), change: z.number(), trend: z.enum(['improved', 'declined', 'stable']) }),
      lateSubmissions: z.object({ before: z.number(), after: z.number(), change: z.number(), trend: z.enum(['improved', 'declined', 'stable']) }),
      isAtRisk: z.object({ before: z.boolean(), after: z.boolean(), resolved: z.boolean() }),
    })
    .optional(),
});

export type InterventionOutcome = z.infer<typeof interventionOutcomeSchema>;

export const fetchInterventions = async (courseId: string, studentId?: string): Promise<Intervention[]> => {
  const params = studentId ? { studentId } : undefined;
  const res = await api.get(`/courses/${courseId}/interventions`, { params });
  return z.array(interventionSchema).parse(res.data.data);
};

export const createIntervention = async (
  courseId: string,
  data: CreateInterventionInput,
): Promise<Intervention> => {
  const res = await api.post(`/courses/${courseId}/interventions`, data);
  return interventionSchema.parse(res.data.data);
};

export const generateIntervention = async (
  courseId: string,
  studentId: string,
): Promise<Intervention> => {
  const res = await api.post(`/courses/${courseId}/interventions/generate/${studentId}`);
  return interventionSchema.parse(res.data.data);
};

export const resolveIntervention = async (
  courseId: string,
  id: string,
): Promise<Intervention> => {
  const res = await api.patch(`/courses/${courseId}/interventions/${id}/resolve`);
  return interventionSchema.parse(res.data.data);
};

export const deleteIntervention = async (courseId: string, id: string): Promise<void> => {
  await api.delete(`/courses/${courseId}/interventions/${id}`);
};

export const fetchInterventionOutcome = async (
  courseId: string,
  id: string,
): Promise<InterventionOutcome> => {
  const res = await api.get(`/courses/${courseId}/interventions/${id}/outcome`);
  return interventionOutcomeSchema.parse(res.data.data);
};
