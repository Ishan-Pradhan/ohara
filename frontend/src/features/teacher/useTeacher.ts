import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  fetchMyCourses,
  fetchCourseRoster,
  createFlag,
  fetchStudentFlags,
  resolveFlag,
} from './teacher.api.js';
import type { CreateFlagInput } from './teacher.schema.js';

export const useMyCourses = (enabled = true) =>
  useQuery({ queryKey: ['teacher', 'courses'], queryFn: fetchMyCourses, enabled });

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
