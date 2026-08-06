import { api } from '../../lib/axios.js';
import { studentDashboardSchema, type StudentDashboard } from './dashboard.schema.js';

export const fetchStudentDashboard = async (): Promise<StudentDashboard> => {
  const res = await api.get('/dashboard/me');
  return studentDashboardSchema.parse(res.data.data);
};
