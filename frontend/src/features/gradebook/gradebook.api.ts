import { api } from '../../lib/axios.js';
import { gradebookSchema, gradebookRowSchema, type Gradebook, type GradebookRow } from './gradebook.schema.js';

// batchId omitted -> the course's current batch. Given -> a specific past
// batch's gradebook (viewing completed-course history).
export const fetchGradebook = async (courseId: string, batchId?: string): Promise<Gradebook> => {
  const res = await api.get(`/courses/${courseId}/gradebook`, { params: batchId ? { batchId } : undefined });
  return gradebookSchema.parse(res.data.data);
};

export const fetchMyGrades = async (courseId: string): Promise<GradebookRow | null> => {
  const res = await api.get(`/courses/${courseId}/gradebook/me`);
  return gradebookRowSchema.nullable().parse(res.data.data);
};
