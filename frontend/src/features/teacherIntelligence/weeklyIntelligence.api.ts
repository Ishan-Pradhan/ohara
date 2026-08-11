import { weeklySummarySchema, type WeeklySummary } from './weeklyIntelligence.schema.js';
import { api } from '../../lib/axios.js';

export const fetchWeeklySummary = async (courseId: string): Promise<WeeklySummary> => {
  const res = await api.get(`/courses/${courseId}/weekly-intelligence`);
  return weeklySummarySchema.parse(res.data.data);
};
