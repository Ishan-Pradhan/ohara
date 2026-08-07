import { api } from '../../lib/axios.js';
import { masteryReportSchema, type MasteryReport } from './mastery.schema.js';

export const fetchMasteryReport = async (): Promise<MasteryReport> => {
  const res = await api.get('/dashboard/me/mastery');
  return masteryReportSchema.parse(res.data.data);
};
