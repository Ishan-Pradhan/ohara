import { api } from '../../lib/axios.js';
import { classIntelligenceSchema, type ClassIntelligence } from './classIntelligence.schema.js';

export const fetchClassIntelligence = async (courseId: string): Promise<ClassIntelligence> => {
  const res = await api.get(`/courses/${courseId}/class-intelligence`);
  return classIntelligenceSchema.parse(res.data.data);
};
