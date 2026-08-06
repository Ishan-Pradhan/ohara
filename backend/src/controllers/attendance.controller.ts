import type { Response } from 'express';

import type { AuthRequest } from '../types/auth.types.js';
import { attendanceSessionRepository } from '../repositories/attendanceSessions.repository.js';
import { attendanceRecordRepository } from '../repositories/attendanceRecords.repository.js';
import { enrollmentRepository } from '../repositories/enrollments.repository.js';
import {
  serializeAttendanceSession,
  serializeAttendanceSessionSummary,
  buildAttendancePercentage,
} from '../serializers/attendance.serializer.js';
import type { AttendanceStatus } from '../types/attendance.types.js';
import { asyncHandler } from '../utils/AsyncHandler.js';
import { ok } from '../utils/ApiResponse.js';
import { ApiError } from '../utils/ApiError.js';

const findOwnedSession = async (courseId: string, id: string) => {
  const session = await attendanceSessionRepository.findById(id);
  if (!session || session.courseId !== courseId) {
    throw new ApiError(404, 'Attendance session not found');
  }
  return session;
};

/** Every record's studentId must belong to the course's active roster —
 * never trust the client to only send enrolled students. */
const assertRosterCoverage = async (
  courseId: string,
  records: { studentId: string; status: AttendanceStatus }[],
) => {
  const enrollments = await enrollmentRepository.findByCourseWithStudents(courseId);
  const rosterIds = new Set(enrollments.map((e) => e.studentId));
  for (const r of records) {
    if (!rosterIds.has(r.studentId)) {
      throw new ApiError(400, `Student ${r.studentId} is not actively enrolled in this course`);
    }
  }
};

export const createAttendanceSession = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { courseId } = req.validated?.params as { courseId: string };
    const { sessionDate, records } = req.validated?.body as {
      sessionDate: string;
      records: { studentId: string; status: AttendanceStatus }[];
    };
    const teacherId = req.user?.id;
    if (!teacherId) {
      throw new ApiError(401, 'Unauthorized');
    }

    await assertRosterCoverage(courseId, records);

    const session = await attendanceSessionRepository.create({ courseId, sessionDate, createdBy: teacherId });
    await attendanceRecordRepository.bulkCreate(
      records.map((r) => ({ sessionId: session.id, studentId: r.studentId, status: r.status })),
    );

    const full = await attendanceSessionRepository.findById(session.id);
    if (!full) {
      throw new ApiError(500, 'Failed to load the session that was just created');
    }
    return ok(res, serializeAttendanceSession(full), 'Attendance session recorded', 201);
  },
);

export const listAttendanceSessions = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { courseId } = req.validated?.params as { courseId: string };
    const sessions = await attendanceSessionRepository.findAllByCourse(courseId);
    return ok(res, sessions.map(serializeAttendanceSessionSummary), 'Attendance sessions retrieved');
  },
);

export const getAttendanceSession = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { courseId, id } = req.validated?.params as { courseId: string; id: string };
    const session = await findOwnedSession(courseId, id);
    return ok(res, serializeAttendanceSession(session), 'Attendance session retrieved');
  },
);

export const updateAttendanceSession = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { courseId, id } = req.validated?.params as { courseId: string; id: string };
    const { records } = req.validated?.body as { records: { studentId: string; status: AttendanceStatus }[] };

    await findOwnedSession(courseId, id);
    await assertRosterCoverage(courseId, records);

    await attendanceRecordRepository.deleteBySession(id);
    await attendanceRecordRepository.bulkCreate(
      records.map((r) => ({ sessionId: id, studentId: r.studentId, status: r.status })),
    );

    const full = await attendanceSessionRepository.findById(id);
    if (!full) {
      throw new ApiError(404, 'Attendance session not found');
    }
    return ok(res, serializeAttendanceSession(full), 'Attendance session updated');
  },
);

export const deleteAttendanceSession = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { courseId, id } = req.validated?.params as { courseId: string; id: string };
    await findOwnedSession(courseId, id);
    await attendanceSessionRepository.delete(id);
    return ok(res, null, 'Attendance session deleted');
  },
);

export const getAttendanceSummary = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { courseId } = req.validated?.params as { courseId: string };
    const enrollments = await enrollmentRepository.findByCourseWithStudents(courseId);
    const byStudent = await attendanceRecordRepository.countByStatusForCourse(courseId);

    const summary = enrollments.map((e) => ({
      studentId: e.studentId,
      studentName: e.student?.name ?? 'Unknown student',
      ...buildAttendancePercentage(byStudent[e.studentId] ?? []),
    }));
    return ok(res, summary, 'Attendance summary retrieved');
  },
);

export const getMyAttendance = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { courseId } = req.validated?.params as { courseId: string };
    const studentId = req.user?.id;
    if (!studentId) {
      throw new ApiError(401, 'Unauthorized');
    }
    const records = await attendanceRecordRepository.findByStudentAndCourse(studentId, courseId);
    return ok(
      res,
      buildAttendancePercentage(records.map((r) => ({ status: r.status }))),
      'Attendance retrieved',
    );
  },
);
