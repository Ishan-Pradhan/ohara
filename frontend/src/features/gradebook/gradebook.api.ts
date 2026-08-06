import { api } from '../../lib/axios.js';
import { gradebookSchema, gradebookRowSchema, type Gradebook, type GradebookRow } from './gradebook.schema.js';

export const fetchGradebook = async (courseId: string): Promise<Gradebook> => {
  const res = await api.get(`/courses/${courseId}/gradebook`);
  return gradebookSchema.parse(res.data.data);
};

export const fetchMyGrades = async (courseId: string): Promise<GradebookRow | null> => {
  const res = await api.get(`/courses/${courseId}/gradebook/me`);
  return gradebookRowSchema.nullable().parse(res.data.data);
};
