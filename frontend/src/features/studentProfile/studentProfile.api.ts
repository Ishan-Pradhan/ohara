import { api } from '../../lib/axios.js';
import { studentProfileSchema, updateStudentProfileSchema } from './studentProfile.schema.js';
import type { StudentProfile, UpdateStudentProfileInput } from './studentProfile.schema.js';

export const fetchMyProfile = async (): Promise<StudentProfile | null> => {
  const res = await api.get('/students/me/profile');
  const data = res.data.data;
  if (data === null) return null;
  return studentProfileSchema.parse(data);
};

export const updateMyProfile = async (input: UpdateStudentProfileInput): Promise<StudentProfile> => {
  const validated = updateStudentProfileSchema.parse(input);
  const res = await api.patch('/students/me/profile', validated);
  return studentProfileSchema.parse(res.data.data);
};
