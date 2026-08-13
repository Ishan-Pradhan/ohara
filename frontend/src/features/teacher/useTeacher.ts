import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  fetchMyCourses,
  fetchCourseRoster,
  createFlag,
  fetchStudentFlags,
  resolveFlag,
  fetchMyStudents,
  fetchMyStudent,
  fetchMyStudentNotes,
  createMyStudentNote,
  deleteMyStudentNote,
} from './teacher.api.js';
import type { CreateFlagInput } from './teacher.schema.js';

// Exported so other features (e.g. documents' knowledge-base selection,
// which changes a field on the course object) can invalidate this cache
// too, instead of only institution's COURSES_KEY (the admin-facing one) —
// the two are separate caches for the same underlying course data.
export const TEACHER_COURSES_KEY = ['teacher', 'courses'] as const;

export const useMyCourses = (enabled = true) =>
  useQuery({ queryKey: TEACHER_COURSES_KEY, queryFn: fetchMyCourses, enabled });

export const useCourseRoster = (courseId: string) =>
  useQuery({
    queryKey: ['teacher', 'courses', courseId, 'students'],
    queryFn: () => fetchCourseRoster(courseId),
    enabled: Boolean(courseId),
  });

export const useCreateFlag = () =>
  useMutation({ mutationFn: (input: CreateFlagInput) => createFlag(input) });

export const studentFlagsKey = (studentId: string) => ['admin', 'student-flags', studentId] as const;

export const useStudentFlags = (studentId: string) =>
  useQuery({
    queryKey: studentFlagsKey(studentId),
    queryFn: () => fetchStudentFlags(studentId),
    enabled: Boolean(studentId),
  });

export const useResolveFlag = (studentId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => resolveFlag(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: studentFlagsKey(studentId) }),
  });
};

export const MY_STUDENTS_KEY = ['teacher', 'students'] as const;

export const useMyStudents = () =>
  useQuery({ queryKey: MY_STUDENTS_KEY, queryFn: fetchMyStudents });

export const myStudentKey = (studentId: string) => ['teacher', 'students', studentId] as const;

export const useMyStudent = (studentId: string) =>
  useQuery({
    queryKey: myStudentKey(studentId),
    queryFn: () => fetchMyStudent(studentId),
    enabled: Boolean(studentId),
  });

export const myStudentNotesKey = (studentId: string) =>
  ['teacher', 'students', studentId, 'notes'] as const;

export const useMyStudentNotes = (studentId: string) =>
  useQuery({
    queryKey: myStudentNotesKey(studentId),
    queryFn: () => fetchMyStudentNotes(studentId),
    enabled: Boolean(studentId),
  });

export const useCreateMyStudentNote = (studentId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (content: string) => createMyStudentNote(studentId, content),
    onSuccess: () => qc.invalidateQueries({ queryKey: myStudentNotesKey(studentId) }),
  });
};

export const useDeleteMyStudentNote = (studentId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (noteId: string) => deleteMyStudentNote(studentId, noteId),
    onSuccess: () => qc.invalidateQueries({ queryKey: myStudentNotesKey(studentId) }),
  });
};
