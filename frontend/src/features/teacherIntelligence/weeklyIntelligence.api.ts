import {
  weeklySummarySchema,
  generatedWeeklySummaryInsightsSchema,
  type WeeklySummary,
} from './weeklyIntelligence.schema.js';
import { api } from '../../lib/axios.js';

export const fetchWeeklySummary = async (courseId: string): Promise<WeeklySummary> => {
  const res = await api.get(`/courses/${courseId}/weekly-intelligence`);
  return weeklySummarySchema.parse(res.data.data);
};

/** Explicitly triggered only — never called automatically. */
export const generateWeeklySummaryInsights = async (courseId: string) => {
  const res = await api.post(`/courses/${courseId}/weekly-intelligence/insights`);
  return generatedWeeklySummaryInsightsSchema.parse(res.data.data);
};
