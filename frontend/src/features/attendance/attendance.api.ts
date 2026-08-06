import { z } from 'zod';
import { api } from '../../lib/axios.js';
import {
  attendanceSessionSchema,
  attendanceSessionSummarySchema,
  attendancePercentageSchema,
  attendanceSummaryRowSchema,
  type AttendanceSession,
  type AttendanceSessionSummary,
  type AttendancePercentage,
  type AttendanceSummaryRow,
  type CreateAttendanceSessionInput,
  type AttendanceStatus,
} from './attendance.schema.js';

export const fetchAttendanceSessions = async (courseId: string): Promise<AttendanceSessionSummary[]> => {
  const res = await api.get(`/courses/${courseId}/attendance/sessions`);
  return z.array(attendanceSessionSummarySchema).parse(res.data.data);
};

export const fetchAttendanceSession = async (courseId: string, id: string): Promise<AttendanceSession> => {
  const res = await api.get(`/courses/${courseId}/attendance/sessions/${id}`);
  return attendanceSessionSchema.parse(res.data.data);
};

export const createAttendanceSession = async (
  courseId: string,
  input: CreateAttendanceSessionInput,
): Promise<AttendanceSession> => {
  const res = await api.post(`/courses/${courseId}/attendance/sessions`, input);
  return attendanceSessionSchema.parse(res.data.data);
};

export const updateAttendanceSession = async (
  courseId: string,
  id: string,
  records: { studentId: string; status: AttendanceStatus }[],
): Promise<AttendanceSession> => {
  const res = await api.patch(`/courses/${courseId}/attendance/sessions/${id}`, { records });
  return attendanceSessionSchema.parse(res.data.data);
};

export const deleteAttendanceSession = async (courseId: string, id: string): Promise<void> => {
  await api.delete(`/courses/${courseId}/attendance/sessions/${id}`);
};

export const fetchAttendanceSummary = async (courseId: string): Promise<AttendanceSummaryRow[]> => {
  const res = await api.get(`/courses/${courseId}/attendance/summary`);
  return z.array(attendanceSummaryRowSchema).parse(res.data.data);
};

export const fetchMyAttendance = async (courseId: string): Promise<AttendancePercentage> => {
  const res = await api.get(`/courses/${courseId}/attendance/me`);
  return attendancePercentageSchema.parse(res.data.data);
};
