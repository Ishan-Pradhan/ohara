import { institutionPerformanceSchema, type InstitutionPerformance } from './institutionPerformance.schema.js';
import { api } from '../../lib/axios.js';

export const fetchInstitutionPerformance = async (): Promise<InstitutionPerformance> => {
  const res = await api.get('/admin/institution-performance');
  return institutionPerformanceSchema.parse(res.data.data);
};
