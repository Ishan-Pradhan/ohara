import { z } from 'zod';
import { api } from '../../lib/axios.js';
import { atRiskRowSchema, type AtRiskRow } from './atRisk.schema.js';

// batchId omitted -> the course's current batch. Given -> a specific past
// batch's at-risk metrics (viewing completed-course history). sectionId
// stays a separate narrowing filter within a batch.
export const fetchAtRiskDashboard = async (
  courseId: string,
  sectionId?: string,
  batchId?: string,
): Promise<AtRiskRow[]> => {
  const params: Record<string, string> = {};
  if (sectionId) params.sectionId = sectionId;
  if (batchId) params.batchId = batchId;
  const res = await api.get(`/courses/${courseId}/at-risk`, { params });
  return z.array(atRiskRowSchema).parse(res.data.data);
};

export const explainAtRisk = async (
  courseId: string,
  studentId: string,
  batchId?: string,
): Promise<string> => {
  const res = await api.post(
    `/courses/${courseId}/at-risk/${studentId}/explain`,
    undefined,
    { params: batchId ? { batchId } : undefined },
  );
  return z.object({ studentId: z.string(), explanation: z.string() }).parse(res.data.data).explanation;
};
