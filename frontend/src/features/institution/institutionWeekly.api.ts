import {
  institutionWeeklySchema,
  generatedInstitutionWeeklyInsightsSchema,
  type InstitutionWeekly,
} from './institutionWeekly.schema.js';
import { api } from '../../lib/axios.js';

export const fetchInstitutionWeekly = async (): Promise<InstitutionWeekly> => {
  const res = await api.get('/admin/weekly-intelligence');
  return institutionWeeklySchema.parse(res.data.data);
};

/** Explicitly triggered only — never called automatically. */
export const generateInstitutionWeeklyInsights = async () => {
  const res = await api.post('/admin/weekly-intelligence/insights');
  return generatedInstitutionWeeklyInsightsSchema.parse(res.data.data);
};
