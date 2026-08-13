import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  fetchAttendanceSessions,
  fetchAttendanceSession,
  fetchAttendanceRoster,
  fetchAttendanceSections,
  createAttendanceSession,
  updateAttendanceSession,
  deleteAttendanceSession,
  fetchAttendanceSummary,
  fetchMyAttendance,
} from './attendance.api.js';
import type { AttendanceStatus, CreateAttendanceSessionInput } from './attendance.schema.js';

export const attendanceSessionsKey = (courseId: string, sectionId?: string) =>
  ['attendanceSessions', courseId, sectionId] as const;
export const attendanceSessionKey = (courseId: string, id: string) =>
  ['attendanceSession', courseId, id] as const;
export const attendanceSummaryKey = (courseId: string, sectionId?: string) =>
  ['attendanceSummary', courseId, sectionId] as const;
export const myAttendanceKey = (courseId: string) => ['myAttendance', courseId] as const;

export const useAttendanceSessions = (courseId: string, sectionId?: string) =>
  useQuery({
    queryKey: attendanceSessionsKey(courseId, sectionId),
    queryFn: () => fetchAttendanceSessions(courseId, sectionId),
    enabled: Boolean(courseId),
  });

export const useAttendanceSession = (courseId: string, id: string) =>
  useQuery({
    queryKey: attendanceSessionKey(courseId, id),
    queryFn: () => fetchAttendanceSession(courseId, id),
    enabled: Boolean(courseId) && Boolean(id),
  });

export const attendanceSectionsKey = (courseId: string, batchId?: string) =>
  ['attendanceSections', courseId, batchId ?? null] as const;

export const useAttendanceSections = (courseId: string, batchId?: string) =>
  useQuery({
    queryKey: attendanceSectionsKey(courseId, batchId),
    queryFn: () => fetchAttendanceSections(courseId, batchId),
    enabled: Boolean(courseId),
  });

export const attendanceRosterKey = (courseId: string, sectionId: string) =>
  ['attendanceRoster', courseId, sectionId] as const;

export const useAttendanceRoster = (courseId: string, sectionId: string) =>
  useQuery({
    queryKey: attendanceRosterKey(courseId, sectionId),
    queryFn: () => fetchAttendanceRoster(courseId, sectionId),
    enabled: Boolean(courseId) && Boolean(sectionId),
  });

export const useAttendanceSummary = (courseId: string, sectionId?: string) =>
  useQuery({
    queryKey: attendanceSummaryKey(courseId, sectionId),
    queryFn: () => fetchAttendanceSummary(courseId, sectionId),
    enabled: Boolean(courseId),
  });

export const useMyAttendance = (courseId: string) =>
  useQuery({
    queryKey: myAttendanceKey(courseId),
    queryFn: () => fetchMyAttendance(courseId),
    enabled: Boolean(courseId),
  });

const invalidateAttendance = (qc: ReturnType<typeof useQueryClient>, courseId: string) => {
  void qc.invalidateQueries({ queryKey: ['attendanceSessions', courseId] });
  void qc.invalidateQueries({ queryKey: ['attendanceSummary', courseId] });
};

export const useCreateAttendanceSession = (courseId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateAttendanceSessionInput) => createAttendanceSession(courseId, input),
    onSuccess: () => invalidateAttendance(qc, courseId),
  });
};

export const useUpdateAttendanceSession = (courseId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, records }: { id: string; records: { studentId: string; status: AttendanceStatus }[] }) =>
      updateAttendanceSession(courseId, id, records),
    onSuccess: (_data, { id }) => {
      invalidateAttendance(qc, courseId);
      void qc.invalidateQueries({ queryKey: attendanceSessionKey(courseId, id) });
    },
  });
};

export const useDeleteAttendanceSession = (courseId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteAttendanceSession(courseId, id),
    onSuccess: () => invalidateAttendance(qc, courseId),
  });
};
