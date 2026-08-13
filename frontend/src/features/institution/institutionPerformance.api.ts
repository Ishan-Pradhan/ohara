import {
  institutionPerformanceSchema,
  generatedInstitutionPerformanceInsightsSchema,
  type InstitutionPerformance,
} from './institutionPerformance.schema.js';
import { api } from '../../lib/axios.js';

export const fetchInstitutionPerformance = async (): Promise<InstitutionPerformance> => {
  const res = await api.get('/admin/institution-performance');
  return institutionPerformanceSchema.parse(res.data.data);
};

/** Explicitly triggered only — never called automatically. */
export const generateInstitutionPerformanceInsights = async () => {
  const res = await api.post('/admin/institution-performance/insights');
  return generatedInstitutionPerformanceInsightsSchema.parse(res.data.data);
};
