import type { Response } from 'express';

import type { AuthRequest } from '../types/auth.types.js';
import { attendanceSessionRepository } from '../repositories/attendanceSessions.repository.js';
import { attendanceRecordRepository } from '../repositories/attendanceRecords.repository.js';
import { enrollmentRepository } from '../repositories/enrollments.repository.js';
import { classMembershipRepository } from '../repositories/classMemberships.repository.js';
import { courseRepository } from '../repositories/courses.repository.js';
import { classRepository } from '../repositories/classes.repository.js';
import { programRepository } from '../repositories/programs.repository.js';
import { sectionRepository } from '../repositories/sections.repository.js';
import { academicYearRepository } from '../repositories/academicYears.repository.js';
import {
  serializeAttendanceSession,
  serializeAttendanceSessionSummary,
  buildAttendancePercentage,
} from '../serializers/attendance.serializer.js';
import { deriveClassTerm } from '../utils/academicTerm.utils.js';
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

/** A class meeting is always for one specific section — a course can be
 * taught to several sections of the same class, so "everyone enrolled in
 * the course" would leak other sections' students into a session. Roster =
 * enrolled in this course AND currently placed in this section. */
const getSectionCourseRoster = async (courseId: string, sectionId: string) => {
  const [enrollments, members] = await Promise.all([
    enrollmentRepository.findByCourseWithStudents(courseId),
    classMembershipRepository.findBySectionWithStudents(sectionId),
  ]);
  const sectionStudentIds = new Set(members.map((m) => m.studentId));
  return enrollments.filter((e) => sectionStudentIds.has(e.studentId));
};

/** Every record's studentId must belong to the course+section roster —
 * never trust the client to only send enrolled, correctly-sectioned
 * students. */
const assertRosterCoverage = async (
  courseId: string,
  sectionId: string,
  records: { studentId: string; status: AttendanceStatus }[],
) => {
  const roster = await getSectionCourseRoster(courseId, sectionId);
  const rosterIds = new Set(roster.map((e) => e.studentId));
  for (const r of records) {
    if (!rosterIds.has(r.studentId)) {
      throw new ApiError(
        400,
        `Student ${r.studentId} is not enrolled in this course and placed in this section`,
      );
    }
  }
};

/** Which sections a "take attendance" screen should offer for this course —
 * every section of the course's class in whichever academic year is most
 * relevant right now. Prefers the year marked current for this class's own
 * term (odd/even/annual, derived from institutionType + orderIndex so
 * neither the frontend nor a teacher has to guess); falls back to the most
 * recent year that actually has sections for this class, so a forgetful
 * admin who hasn't flagged a year current yet doesn't leave teachers with
 * nothing to pick from. Teacher-safe: no admin-only institution data leaks
 * through this endpoint, unlike /admin/classes or /admin/programs. */
export const listAttendanceSections = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { courseId } = req.validated?.params as { courseId: string };

    const course = await courseRepository.findById(courseId);
    if (!course) {
      throw new ApiError(404, 'Course not found');
    }

    const allClassSections = await sectionRepository.findAll({ classId: course.classId });
    if (allClassSections.length === 0) {
      return ok(res, [], 'Sections retrieved');
    }

    const cls = await classRepository.findById(course.classId);
    const program = cls ? await programRepository.findById(cls.programId) : null;
    const term = cls && program ? deriveClassTerm(program.institutionType, cls.orderIndex) : 'annual';

    const years = await academicYearRepository.findAll();
    const yearById = new Map(years.map((y) => [y.id, y]));
    const currentTermYear = years.find((y) => y.isCurrent && y.term === term);

    const targetYearId =
      currentTermYear && allClassSections.some((s) => s.academicYearId === currentTermYear.id)
        ? currentTermYear.id
        : [...new Set(allClassSections.map((s) => s.academicYearId))].sort((a, b) =>
            (yearById.get(b)?.startDate ?? '').localeCompare(yearById.get(a)?.startDate ?? ''),
          )[0];

    const relevantSections = allClassSections.filter((s) => s.academicYearId === targetYearId);
    return ok(
      res,
      relevantSections.map((s) => ({ id: s.id, name: s.name })),
      'Sections retrieved',
    );
  },
);

export const getAttendanceRoster = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { courseId } = req.validated?.params as { courseId: string };
    const { sectionId } = req.validated?.query as { sectionId: string };
    const roster = await getSectionCourseRoster(courseId, sectionId);
    return ok(
      res,
      roster.map((e) => ({ studentId: e.studentId, studentName: e.student?.name ?? 'Unknown student' })),
      'Roster retrieved',
    );
  },
);

export const createAttendanceSession = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { courseId } = req.validated?.params as { courseId: string };
    const { sectionId, sessionDate, records } = req.validated?.body as {
      sectionId: string;
      sessionDate: string;
      records: { studentId: string; status: AttendanceStatus; reason?: string }[];
    };
    const teacherId = req.user?.id;
    if (!teacherId) {
      throw new ApiError(401, 'Unauthorized');
    }

    await assertRosterCoverage(courseId, sectionId, records);

    const session = await attendanceSessionRepository.create({
      courseId,
      sectionId,
      sessionDate,
      createdBy: teacherId,
    });
    await attendanceRecordRepository.bulkCreate(
      records.map((r) => ({ sessionId: session.id, studentId: r.studentId, status: r.status, reason: r.reason ?? null })),
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
    const { sectionId } = (req.validated?.query as { sectionId?: string }) ?? {};
    let sessions = await attendanceSessionRepository.findAllByCourse(courseId);
    if (sectionId) {
      sessions = sessions.filter((s) => s.sectionId === sectionId);
    }
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
    const { records } = req.validated?.body as { records: { studentId: string; status: AttendanceStatus; reason?: string }[] };

    const existing = await findOwnedSession(courseId, id);
    if (!existing.sectionId) {
      throw new ApiError(
        400,
        'This session predates section-scoped attendance and cannot be edited — delete and re-take it instead',
      );
    }
    await assertRosterCoverage(courseId, existing.sectionId, records);

    await attendanceRecordRepository.deleteBySession(id);
    await attendanceRecordRepository.bulkCreate(
      records.map((r) => ({ sessionId: id, studentId: r.studentId, status: r.status, reason: r.reason ?? null })),
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
    const { sectionId } = (req.validated?.query as { sectionId?: string }) ?? {};

    let enrollments = await enrollmentRepository.findByCourseWithStudents(courseId);

    // If sectionId is provided, filter to only students in that section
    if (sectionId) {
      const members = await classMembershipRepository.findBySectionWithStudents(sectionId);
      const sectionStudentIds = new Set(members.map((m) => m.studentId));
      enrollments = enrollments.filter((e) => sectionStudentIds.has(e.studentId));
    }

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
