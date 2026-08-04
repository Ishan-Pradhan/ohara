import { z } from 'zod';

import { api } from '../../lib/axios.js';
import {
  teacherCourseSchema,
  teacherSectionSchema,
  rosterStudentSchema,
  studentFlagSchema,
  type TeacherCourse,
  type TeacherSection,
  type RosterStudent,
  type CreateFlagInput,
  type StudentFlag,
} from './teacher.schema.js';

export const fetchMyCourses = async (): Promise<TeacherCourse[]> => {
  const res = await api.get('/teacher/courses');
  return z.array(teacherCourseSchema).parse(res.data.data);
};

export const fetchCourseRoster = async (courseId: string): Promise<RosterStudent[]> => {
  const res = await api.get(`/teacher/courses/${courseId}/students`);
  return z.array(rosterStudentSchema).parse(res.data.data);
};

export const fetchMySection = async (): Promise<TeacherSection | null> => {
  const res = await api.get('/teacher/section');
  const sections = z.array(teacherSectionSchema).parse(res.data.data);
  return sections[0] ?? null;
};

export const fetchSectionRoster = async (sectionId: string): Promise<RosterStudent[]> => {
  const res = await api.get(`/teacher/section/${sectionId}/students`);
  return z.array(rosterStudentSchema).parse(res.data.data);
};

export const createFlag = async (input: CreateFlagInput): Promise<StudentFlag> => {
  const res = await api.post('/teacher/flags', input);
  return studentFlagSchema.parse(res.data.data);
};

export const fetchStudentFlags = async (studentId: string): Promise<StudentFlag[]> => {
  const res = await api.get(`/admin/students/${studentId}/flags`);
  return z.array(studentFlagSchema).parse(res.data.data);
};

export const resolveFlag = async (id: string): Promise<StudentFlag> => {
  const res = await api.patch(`/admin/student-flags/${id}/resolve`);
  return studentFlagSchema.parse(res.data.data);
};
