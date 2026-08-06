import type { AttendanceSession } from '../models/attendanceSessions.model.js';
import type { AttendanceStatus } from '../types/attendance.types.js';

export const serializeAttendanceSession = (session: AttendanceSession) => ({
  id: session.id,
  courseId: session.courseId,
  sessionDate: session.sessionDate,
  records: (session.records ?? []).map((r) => ({
    studentId: r.studentId,
    studentName: r.student?.name ?? 'Unknown student',
    status: r.status,
  })),
});

export const serializeAttendanceSessionSummary = (session: AttendanceSession) => ({
  id: session.id,
  courseId: session.courseId,
  sessionDate: session.sessionDate,
});

/** FR-34: percentage per student per course. `present` and `late` both count
 * as attended (late is still a mark of attendance, just flagged); `absent`
 * does not. A student with zero sessions gets `null`, not 0 — no sessions
 * taken yet isn't the same as perfect/zero attendance. */
export const buildAttendancePercentage = (records: { status: AttendanceStatus }[]) => {
  const total = records.length;
  const present = records.filter((r) => r.status === 'present').length;
  const absent = records.filter((r) => r.status === 'absent').length;
  const late = records.filter((r) => r.status === 'late').length;
  const percentage = total > 0 ? ((present + late) / total) * 100 : null;
  return { total, present, absent, late, percentage };
};
