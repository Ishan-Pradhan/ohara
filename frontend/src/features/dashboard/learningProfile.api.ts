import { api } from '../../lib/axios.js';
import { learningProfileSchema, type LearningProfile } from './learningProfile.schema.js';

export const fetchLearningProfile = async (): Promise<LearningProfile> => {
  const res = await api.get('/dashboard/me/learning-profile');
  return learningProfileSchema.parse(res.data.data);
};
