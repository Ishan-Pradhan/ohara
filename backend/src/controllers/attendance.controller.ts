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
import type { Section } from '../models/sections.model.js';
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

/** Which academic year is "relevant right now" for a class's attendance —
 * shared by `listAttendanceSections` (which sections to offer) and
 * `getAttendanceSummary`'s whole-course mode (which students to count).
 * Both need the identical answer, or a teacher could be offered one year's
 * sections while the summary silently aggregates a different one.
 *
 * A class can accumulate more than one section sharing the same name across
 * years — e.g. a fresh, empty "Section A" gets created for a new academic
 * year before promotion has actually moved anyone into it, alongside the
 * prior year's "Section A" that still holds the class's real, promoted
 * students until an admin flips `is_current` forward. Preferring "the year
 * marked current for this class's term" alone (the original heuristic) picks
 * whichever year satisfies that flag even when its sections for this class
 * are empty, leaving a teacher looking at a section with zero students while
 * the real roster sits one year over — a real incident, not a hypothetical
 * (fixed 2026-08-12). So the ranking prefers actual enrolled placements over
 * the flag:
 *   1. the current-term year, if its sections for this class have any
 *      enrolled student — the common, correctly-configured case
 *   2. otherwise, whichever year (among those with sections for this class)
 *      has the most enrolled students, most-recent-by-start-date as tiebreak
 *      — recovers correctly even when `is_current` hasn't been advanced yet
 *   3. otherwise (no year has any enrolled student anywhere — a brand new
 *      class nobody has been placed into), the current-term year if it has
 *      sections at all, so a teacher still has something to start filling
 *   4. otherwise, the most recent year by start date — final fallback
 *
 * Returns `undefined` only when the class has no sections at all. */
export const resolveRelevantAttendanceYear = async (
  classId: string,
): Promise<{ targetYearId: string | undefined; allClassSections: Section[] }> => {
  const allClassSections = await sectionRepository.findAll({ classId });
  if (allClassSections.length === 0) {
    return { targetYearId: undefined, allClassSections: [] };
  }

  const cls = await classRepository.findById(classId);
  const program = cls ? await programRepository.findById(cls.programId) : null;
  const term = cls && program ? deriveClassTerm(program.institutionType, cls.orderIndex) : 'annual';

  const years = await academicYearRepository.findAll();
  const yearById = new Map(years.map((y) => [y.id, y]));
  const currentTermYear = years.find((y) => y.isCurrent && y.term === term);

  const countsBySection = await classMembershipRepository.countBySections(
    allClassSections.map((s) => s.id),
  );
  const enrolledCountByYear = new Map<string, number>();
  for (const s of allClassSections) {
    const prior = enrolledCountByYear.get(s.academicYearId) ?? 0;
    enrolledCountByYear.set(s.academicYearId, prior + (countsBySection[s.id] ?? 0));
  }

  const yearIdsWithSections = [...new Set(allClassSections.map((s) => s.academicYearId))];
  const mostPopulatedYearId = yearIdsWithSections
    .filter((id) => (enrolledCountByYear.get(id) ?? 0) > 0)
    .sort((a, b) => {
      const byCount = (enrolledCountByYear.get(b) ?? 0) - (enrolledCountByYear.get(a) ?? 0);
      if (byCount !== 0) return byCount;
      return (yearById.get(b)?.startDate ?? '').localeCompare(yearById.get(a)?.startDate ?? '');
    })[0];

  const mostRecentYearId = [...yearIdsWithSections].sort((a, b) =>
    (yearById.get(b)?.startDate ?? '').localeCompare(yearById.get(a)?.startDate ?? ''),
  )[0];

  // mostPopulatedYearId is only trustworthy over the current-term year when
  // it's the same age or newer — that's the "isCurrent flag hasn't been
  // advanced yet, but the real cohort already moved" case. A mostPopulated
  // candidate OLDER than the current-term year is instead a stale cohort
  // that was never formally promoted/graduated out (their class_membership
  // rows just sat at outcome: 'enrolled' forever) — trusting it would make a
  // genuinely-empty current term permanently show a past batch's data
  // instead of reflecting that nobody's placed there yet.
  const mostPopulatedYear = mostPopulatedYearId ? yearById.get(mostPopulatedYearId) : undefined;
  const mostPopulatedIsCurrentOrNewer =
    !currentTermYear || (mostPopulatedYear?.startDate ?? '').localeCompare(currentTermYear.startDate) >= 0;

  let targetYearId: string | undefined;
  if (currentTermYear && (enrolledCountByYear.get(currentTermYear.id) ?? 0) > 0) {
    targetYearId = currentTermYear.id;
  } else if (mostPopulatedYearId && mostPopulatedIsCurrentOrNewer) {
    targetYearId = mostPopulatedYearId;
  } else if (currentTermYear && yearIdsWithSections.includes(currentTermYear.id)) {
    targetYearId = currentTermYear.id;
  } else {
    targetYearId = mostRecentYearId;
  }

  return { targetYearId, allClassSections };
};

/** Every currently-placed student across every section of `classId` that
 * belongs to `academicYearId` — used for the whole-course attendance
 * summary, which aggregates across all of a class's sections for the
 * relevant year rather than one specific section. Exported for
 * attendanceTrends.controller.ts's identical whole-course need. */
export const findCurrentYearStudentIds = async (classId: string, academicYearId: string): Promise<Set<string>> => {
  const sectionsInYear = await sectionRepository.findAll({ classId, academicYearId });
  const memberLists = await Promise.all(
    sectionsInYear.map((s) => classMembershipRepository.findBySectionWithStudents(s.id)),
  );
  return new Set(memberLists.flat().map((m) => m.studentId));
};

/** Teacher-safe: no admin-only institution data leaks through this endpoint,
 * unlike /admin/classes or /admin/programs. */
export const listAttendanceSections = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { courseId } = req.validated?.params as { courseId: string };

    const course = await courseRepository.findById(courseId);
    if (!course) {
      throw new ApiError(404, 'Course not found');
    }

    const { targetYearId, allClassSections } = await resolveRelevantAttendanceYear(course.classId);
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
    // Needs records (not the lighter findAllByCourse) so a session can be
    // dropped below when every one of its records belongs to a student
    // since promoted/transferred/graduated out — same reasoning as
    // getAttendanceTrends: correct history, but not part of the section's
    // *current* session list, which would otherwise contradict the
    // (already-scoped) roster and summary.
    let sessions = await attendanceSessionRepository.findAllByCourseWithRecords(courseId);
    let currentStudentIds: Set<string> | null = null;

    if (sectionId) {
      // One section belongs to exactly one academic year, so this already
      // excludes every other year's sessions.
      sessions = sessions.filter((s) => s.sectionId === sectionId);
      const members = await classMembershipRepository.findBySectionWithStudents(sectionId);
      currentStudentIds = new Set(members.map((m) => m.studentId));
    } else {
      // Whole-course mode: findAllByCourseWithRecords returns every session
      // ever taken for this course, across every batch that has reused its
      // class — same cross-batch leak as getAttendanceSummary above, same
      // fix: scope to the sections that belong to whichever year is
      // relevant right now.
      const course = await courseRepository.findById(courseId);
      if (course) {
        const { targetYearId, allClassSections } = await resolveRelevantAttendanceYear(course.classId);
        const currentYearSectionIds = new Set(
          allClassSections.filter((s) => s.academicYearId === targetYearId).map((s) => s.id),
        );
        sessions = sessions.filter((s) => s.sectionId !== null && currentYearSectionIds.has(s.sectionId));
        if (targetYearId) {
          currentStudentIds = await findCurrentYearStudentIds(course.classId, targetYearId);
        }
      }
    }

    if (currentStudentIds) {
      const ids = currentStudentIds;
      sessions = sessions.filter((s) => (s.records ?? []).some((r) => ids.has(r.studentId)));
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

    if (sectionId) {
      // A specific section is always one academic year's worth of
      // students, so intersecting with it already scopes correctly.
      const members = await classMembershipRepository.findBySectionWithStudents(sectionId);
      const sectionStudentIds = new Set(members.map((m) => m.studentId));
      enrollments = enrollments.filter((e) => sectionStudentIds.has(e.studentId));
    } else {
      // Whole-course mode: findByCourseWithStudents returns every enrollment
      // ever made for this course, across every year a batch has reused its
      // class — without this, a course between batches (current year has no
      // enrollments yet) still shows the previous batch's attendance, the
      // same cross-batch leak already fixed for assignments/quizzes. Scope
      // to whichever year is actually relevant right now, same resolution
      // listAttendanceSections uses, so the two never disagree.
      const course = await courseRepository.findById(courseId);
      if (course) {
        const { targetYearId } = await resolveRelevantAttendanceYear(course.classId);
        if (targetYearId) {
          const currentYearStudentIds = await findCurrentYearStudentIds(course.classId, targetYearId);
          enrollments = enrollments.filter((e) => currentYearStudentIds.has(e.studentId));
        }
      }
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
