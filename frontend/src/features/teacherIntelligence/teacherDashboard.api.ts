import {
  teacherDashboardSchema,
  generatedInsightsSchema,
  type TeacherDashboard,
} from './teacherDashboard.schema.js';
import { api } from '../../lib/axios.js';

export const fetchTeacherDashboard = async (): Promise<TeacherDashboard> => {
  const res = await api.get('/teacher/dashboard');
  return teacherDashboardSchema.parse(res.data.data);
};

/** Explicitly triggered only — never called automatically. */
export const generateTeacherDashboardInsights = async () => {
  const res = await api.post('/teacher/dashboard/insights');
  return generatedInsightsSchema.parse(res.data.data);
};
