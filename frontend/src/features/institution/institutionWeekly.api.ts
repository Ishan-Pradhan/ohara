import { institutionWeeklySchema, type InstitutionWeekly } from './institutionWeekly.schema.js';
import { api } from '../../lib/axios.js';

export const fetchInstitutionWeekly = async (): Promise<InstitutionWeekly> => {
  const res = await api.get('/admin/weekly-intelligence');
  return institutionWeeklySchema.parse(res.data.data);
};
