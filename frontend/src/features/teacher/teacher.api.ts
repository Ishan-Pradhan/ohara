import { z } from 'zod';

import { api } from '../../lib/axios.js';
import {
  teacherCourseSchema,
  rosterStudentSchema,
  studentFlagSchema,
  myStudentListItemSchema,
  myStudentProfileSchema,
  teacherStudentNoteSchema,
  type TeacherCourse,
  type RosterStudent,
  type CreateFlagInput,
  type StudentFlag,
  type MyStudentListItem,
  type MyStudentProfile,
  type TeacherStudentNote,
} from './teacher.schema.js';

export const fetchMyCourses = async (): Promise<TeacherCourse[]> => {
  const res = await api.get('/teacher/courses');
  return z.array(teacherCourseSchema).parse(res.data.data);
};

export const fetchCourseRoster = async (courseId: string): Promise<RosterStudent[]> => {
  const res = await api.get(`/teacher/courses/${courseId}/students`);
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

export const fetchMyStudents = async (): Promise<MyStudentListItem[]> => {
  const res = await api.get('/teacher/students');
  return z.array(myStudentListItemSchema).parse(res.data.data);
};

export const fetchMyStudent = async (studentId: string): Promise<MyStudentProfile> => {
  const res = await api.get(`/teacher/students/${studentId}`);
  return myStudentProfileSchema.parse(res.data.data);
};

export const fetchMyStudentNotes = async (studentId: string): Promise<TeacherStudentNote[]> => {
  const res = await api.get(`/teacher/students/${studentId}/notes`);
  return z.array(teacherStudentNoteSchema).parse(res.data.data);
};

export const createMyStudentNote = async (
  studentId: string,
  content: string,
): Promise<TeacherStudentNote> => {
  const res = await api.post(`/teacher/students/${studentId}/notes`, { content });
  return teacherStudentNoteSchema.parse(res.data.data);
};

export const deleteMyStudentNote = async (studentId: string, noteId: string): Promise<void> => {
  await api.delete(`/teacher/students/${studentId}/notes/${noteId}`);
};
