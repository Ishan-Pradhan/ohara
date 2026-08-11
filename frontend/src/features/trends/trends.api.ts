import { z } from 'zod';

import { api } from '../../lib/axios.js';
import { gradeTrendPointSchema, attendanceTrendPointSchema } from './trends.schema.js';
import type { GradeTrendPoint, AttendanceTrendPoint } from './trends.schema.js';

export const fetchGradeTrends = async (courseId: string): Promise<GradeTrendPoint[]> => {
  const res = await api.get(`/courses/${courseId}/grade-trends`);
  return z.array(gradeTrendPointSchema).parse(res.data.data);
};

export const fetchAttendanceTrends = async (courseId: string): Promise<AttendanceTrendPoint[]> => {
  const res = await api.get(`/courses/${courseId}/attendance-trends`);
  return z.array(attendanceTrendPointSchema).parse(res.data.data);
};
