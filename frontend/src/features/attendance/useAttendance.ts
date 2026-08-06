import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  fetchAttendanceSessions,
  fetchAttendanceSession,
  createAttendanceSession,
  updateAttendanceSession,
  deleteAttendanceSession,
  fetchAttendanceSummary,
  fetchMyAttendance,
} from './attendance.api.js';
import type { AttendanceStatus, CreateAttendanceSessionInput } from './attendance.schema.js';

export const attendanceSessionsKey = (courseId: string) => ['attendanceSessions', courseId] as const;
export const attendanceSessionKey = (courseId: string, id: string) =>
  ['attendanceSession', courseId, id] as const;
export const attendanceSummaryKey = (courseId: string) => ['attendanceSummary', courseId] as const;
export const myAttendanceKey = (courseId: string) => ['myAttendance', courseId] as const;

export const useAttendanceSessions = (courseId: string) =>
  useQuery({
    queryKey: attendanceSessionsKey(courseId),
    queryFn: () => fetchAttendanceSessions(courseId),
    enabled: Boolean(courseId),
  });

export const useAttendanceSession = (courseId: string, id: string) =>
  useQuery({
    queryKey: attendanceSessionKey(courseId, id),
    queryFn: () => fetchAttendanceSession(courseId, id),
    enabled: Boolean(courseId) && Boolean(id),
  });

export const useAttendanceSummary = (courseId: string) =>
  useQuery({
    queryKey: attendanceSummaryKey(courseId),
    queryFn: () => fetchAttendanceSummary(courseId),
    enabled: Boolean(courseId),
  });

export const useMyAttendance = (courseId: string) =>
  useQuery({
    queryKey: myAttendanceKey(courseId),
    queryFn: () => fetchMyAttendance(courseId),
    enabled: Boolean(courseId),
  });

const invalidateAttendance = (qc: ReturnType<typeof useQueryClient>, courseId: string) => {
  void qc.invalidateQueries({ queryKey: attendanceSessionsKey(courseId) });
  void qc.invalidateQueries({ queryKey: attendanceSummaryKey(courseId) });
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
