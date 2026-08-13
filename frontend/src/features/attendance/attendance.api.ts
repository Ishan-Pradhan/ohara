import { z } from 'zod';
import { api } from '../../lib/axios.js';
import {
  attendanceSessionSchema,
  attendanceSessionSummarySchema,
  attendanceRosterEntrySchema,
  attendanceSectionOptionSchema,
  attendancePercentageSchema,
  attendanceSummaryRowSchema,
  type AttendanceSession,
  type AttendanceSessionSummary,
  type AttendanceRosterEntry,
  type AttendanceSectionOption,
  type AttendancePercentage,
  type AttendanceSummaryRow,
  type CreateAttendanceSessionInput,
  type AttendanceStatus,
} from './attendance.schema.js';

export const fetchAttendanceSessions = async (courseId: string, sectionId?: string): Promise<AttendanceSessionSummary[]> => {
  const params = sectionId ? { sectionId } : undefined;
  const res = await api.get(`/courses/${courseId}/attendance/sessions`, { params });
  return z.array(attendanceSessionSummarySchema).parse(res.data.data);
};

// batchId omitted -> whichever batch is currently relevant. Given -> that
// specific batch's sections (browsing completed-course history).
export const fetchAttendanceSections = async (courseId: string, batchId?: string): Promise<AttendanceSectionOption[]> => {
  const res = await api.get(`/courses/${courseId}/attendance/sections`, { params: batchId ? { batchId } : undefined });
  return z.array(attendanceSectionOptionSchema).parse(res.data.data);
};

export const fetchAttendanceRoster = async (
  courseId: string,
  sectionId: string,
): Promise<AttendanceRosterEntry[]> => {
  const res = await api.get(`/courses/${courseId}/attendance/roster`, { params: { sectionId } });
  return z.array(attendanceRosterEntrySchema).parse(res.data.data);
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
  records: { studentId: string; status: AttendanceStatus; reason?: string }[],
): Promise<AttendanceSession> => {
  const res = await api.patch(`/courses/${courseId}/attendance/sessions/${id}`, { records });
  return attendanceSessionSchema.parse(res.data.data);
};

export const deleteAttendanceSession = async (courseId: string, id: string): Promise<void> => {
  await api.delete(`/courses/${courseId}/attendance/sessions/${id}`);
};

export const fetchAttendanceSummary = async (courseId: string, sectionId?: string): Promise<AttendanceSummaryRow[]> => {
  const params = sectionId ? { sectionId } : undefined;
  const res = await api.get(`/courses/${courseId}/attendance/summary`, { params });
  return z.array(attendanceSummaryRowSchema).parse(res.data.data);
};

export const fetchMyAttendance = async (courseId: string): Promise<AttendancePercentage> => {
  const res = await api.get(`/courses/${courseId}/attendance/me`);
  return attendancePercentageSchema.parse(res.data.data);
};
