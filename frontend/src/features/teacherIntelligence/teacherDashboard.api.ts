import { teacherDashboardSchema, type TeacherDashboard } from './teacherDashboard.schema.js';
import { api } from '../../lib/axios.js';

export const fetchTeacherDashboard = async (): Promise<TeacherDashboard> => {
  const res = await api.get('/teacher/dashboard');
  return teacherDashboardSchema.parse(res.data.data);
};
