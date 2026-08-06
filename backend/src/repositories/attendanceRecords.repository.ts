import { AttendanceRecord } from '../models/attendanceRecords.model.js';
import { AttendanceSession } from '../models/attendanceSessions.model.js';
import type { AttendanceRecordCreationAttributes, AttendanceStatus } from '../types/attendance.types.js';

export const attendanceRecordRepository = {
  bulkCreate: async (data: AttendanceRecordCreationAttributes[]): Promise<AttendanceRecord[]> => {
    if (data.length === 0) return [];
    return await AttendanceRecord.bulkCreate(data);
  },

  findBySession: async (sessionId: string): Promise<AttendanceRecord[]> => {
    return await AttendanceRecord.findAll({ where: { sessionId }, include: ['student'] });
  },

  deleteBySession: async (sessionId: string): Promise<void> => {
    await AttendanceRecord.destroy({ where: { sessionId } });
  },

  /** Every record for a student across a course's sessions — the raw input
   * to the attendance-percentage calculation (done in the controller/
   * serializer, not here; this is a DB-only read). */
  findByStudentAndCourse: async (studentId: string, courseId: string): Promise<AttendanceRecord[]> => {
    return await AttendanceRecord.findAll({
      where: { studentId },
      include: [{ model: AttendanceSession, as: 'session', where: { courseId }, attributes: [] }],
    });
  },

  countByStatusForCourse: async (
    courseId: string,
  ): Promise<Record<string, { studentId: string; status: AttendanceStatus }[]>> => {
    const records = await AttendanceRecord.findAll({
      include: [{ model: AttendanceSession, as: 'session', where: { courseId }, attributes: [] }],
      attributes: ['studentId', 'status'],
      raw: true,
    });
    const byStudent: Record<string, { studentId: string; status: AttendanceStatus }[]> = {};
    for (const r of records as unknown as { studentId: string; status: AttendanceStatus }[]) {
      (byStudent[r.studentId] ??= []).push(r);
    }
    return byStudent;
  },
};
