import { z } from 'zod';
import { api } from '../../lib/axios.js';
import { atRiskRowSchema, type AtRiskRow } from './atRisk.schema.js';

export const fetchAtRiskDashboard = async (courseId: string, sectionId?: string): Promise<AtRiskRow[]> => {
  const params: Record<string, string> = {};
  if (sectionId) params.sectionId = sectionId;
  const res = await api.get(`/courses/${courseId}/at-risk`, { params });
  return z.array(atRiskRowSchema).parse(res.data.data);
};

export const explainAtRisk = async (courseId: string, studentId: string): Promise<string> => {
  const res = await api.post(`/courses/${courseId}/at-risk/${studentId}/explain`);
  return z.object({ studentId: z.string(), explanation: z.string() }).parse(res.data.data).explanation;
};
