import type { Response } from 'express';

import type { AuthRequest } from '../types/auth.types.js';
import { attendanceSessionRepository } from '../repositories/attendanceSessions.repository.js';
import { attendanceRecordRepository } from '../repositories/attendanceRecords.repository.js';
import { enrollmentRepository } from '../repositories/enrollments.repository.js';
import { classMembershipRepository } from '../repositories/classMemberships.repository.js';
import { courseRepository } from '../repositories/courses.repository.js';
import { sectionRepository } from '../repositories/sections.repository.js';
import type { Section } from '../models/sections.model.js';
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

/** A Section is permanently tied to one (class, batch) cohort and is never
 * reused by a later intake, so once a specific sectionId is given there's no
 * "mixing cohorts" ambiguity left to resolve — this is that section's true
 * roster: every student who was EVER enrolled in this course under that
 * section's own batch and placed in that exact section, any outcome
 * (enrolled/promoted/transferred/graduated), not just currently-active. Used
 * for viewing (getAttendanceSummary's per-section mode) *and* for
 * taking/editing attendance (getAttendanceRoster, assertRosterCoverage
 * below) — a section that's already been fully promoted/graduated out still
 * needs to accept edits to the sessions recorded while it was active, and a
 * currently-active section's departed individual members still need their
 * historical sessions editable too. Restricting either of those to
 * currently-`enrolled`-only used to reject every edit to a since-superseded
 * section's sessions as "not enrolled" — the roster shown and the roster
 * validated against must always be the same list, or a student visible in
 * the form gets rejected the moment it's saved. See
 * docs/superpowers/specs/2026-08-13-completed-course-history-design.md. */
const getSectionCourseRosterEver = async (courseId: string, sectionId: string) => {
  const section = await sectionRepository.findById(sectionId);
  if (!section) return [];
  const [enrollments, members] = await Promise.all([
    enrollmentRepository.findByCourseAndBatchWithStudents(courseId, section.batchId),
    classMembershipRepository.findAll({ sectionId }),
  ]);
  const sectionStudentIds = new Set(members.map((m) => m.studentId));
  return enrollments.filter((e) => sectionStudentIds.has(e.studentId));
};

/** Every record's studentId must belong to the course+section roster —
 * never trust the client to only send enrolled, correctly-sectioned
 * students. Matches getSectionCourseRosterEver (not a currently-enrolled-only
 * check) so a session can still be taken/edited for a section whose cohort
 * has since been promoted/transferred/graduated out — exactly the same
 * roster getAttendanceRoster shows the teacher to build the form from. */
const assertRosterCoverage = async (
  courseId: string,
  sectionId: string,
  records: { studentId: string; status: AttendanceStatus }[],
) => {
  const roster = await getSectionCourseRosterEver(courseId, sectionId);
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

/** Which batch is "relevant right now" for a class's attendance — shared by
 * `listAttendanceSections` (which sections to offer) and
 * `getAttendanceSummary`'s whole-course mode (which students to count).
 * Both need the identical answer, or a teacher could be offered one batch's
 * sections while the summary silently aggregates a different one.
 *
 * **Rewritten 2026-08-13** for the batch-permanent placement model: a batch's
 * `class_memberships.outcome = 'enrolled'` rows now ARE its current
 * placement, directly — no more year-matching heuristics. Ranking:
 *   1. whichever batch (among those with sections for this class) currently
 *      has `enrolled` students — resolved by
 *      `classMembershipRepository.findCurrentBatchIdForClass` (the same
 *      resolver courses.controller.ts's resolveCurrentBatchForCourseOrNull
 *      uses, so the two can't disagree; see its doc comment for why recency,
 *      not headcount, breaks the tie when two batches are both present)
 *   2. if nobody is currently enrolled anywhere in this class yet (a brand
 *      new class, or between batches), fall back to the most recently
 *      created section's batch, so a teacher still has something to start
 *      filling
 *
 * Returns `undefined` only when the class has no sections at all. */
export const resolveRelevantAttendanceBatch = async (
  classId: string,
): Promise<{ targetBatchId: string | undefined; allClassSections: Section[] }> => {
  const allClassSections = await sectionRepository.findAll({ classId });
  if (allClassSections.length === 0) {
    return { targetBatchId: undefined, allClassSections: [] };
  }

  const currentBatchId = await classMembershipRepository.findCurrentBatchIdForClass(classId);
  if (currentBatchId) {
    return { targetBatchId: currentBatchId, allClassSections };
  }

  const mostRecentSection = [...allClassSections].sort(
    (a, b) => new Date(b.createdAt as unknown as string).getTime() - new Date(a.createdAt as unknown as string).getTime(),
  )[0];
  return { targetBatchId: mostRecentSection?.batchId, allClassSections };
};

/** Every currently-placed student across every section of `classId` that
 * belongs to `batchId` — used for the whole-course attendance summary,
 * which aggregates across all of a class's sections for the relevant batch
 * rather than one specific section. Exported for
 * attendanceTrends.controller.ts's identical whole-course need. */
export const findCurrentBatchStudentIds = async (classId: string, batchId: string): Promise<Set<string>> => {
  const sectionsInBatch = await sectionRepository.findAll({ classId, batchId });
  const memberLists = await Promise.all(
    sectionsInBatch.map((s) => classMembershipRepository.findBySectionWithStudents(s.id)),
  );
  return new Set(memberLists.flat().map((m) => m.studentId));
};

/** Teacher-safe: no admin-only institution data leaks through this endpoint,
 * unlike /admin/classes or /admin/programs. `batchId` omitted -> whichever
 * batch is currently relevant (unchanged default, what a "take attendance"
 * screen should offer). Given -> that specific batch's sections, for a
 * teacher browsing a past batch's attendance the same way Gradebook/At-Risk
 * already let them — see
 * docs/superpowers/specs/2026-08-13-completed-course-history-design.md. */
export const listAttendanceSections = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { courseId } = req.validated?.params as { courseId: string };
    const { batchId } = (req.validated?.query ?? {}) as { batchId?: string };

    const course = await courseRepository.findById(courseId);
    if (!course) {
      throw new ApiError(404, 'Course not found');
    }

    let relevantSections: Section[];
    if (batchId) {
      relevantSections = await sectionRepository.findAll({ classId: course.classId, batchId });
    } else {
      const { targetBatchId, allClassSections } = await resolveRelevantAttendanceBatch(course.classId);
      relevantSections = allClassSections.filter((s) => s.batchId === targetBatchId);
    }
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
    const roster = await getSectionCourseRosterEver(courseId, sectionId);
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
    // Needs records (not the lighter findAllByCourse) so whole-course mode
    // (below) can narrow to the relevant batch's records.
    let sessions = await attendanceSessionRepository.findAllByCourseWithRecords(courseId);
    let currentStudentIds: Set<string> | null = null;

    if (sectionId) {
      // One section belongs to exactly one batch, and is never reused, so
      // this already excludes every other batch's sessions with no
      // ambiguity left to resolve — every session ever recorded here is
      // legitimately part of this section's history, regardless of
      // whether its students have since been promoted/transferred/
      // graduated out (fixed 2026-08-13 — this used to also narrow to
      // *currently*-enrolled students, which silently emptied the whole
      // list the moment a section's entire cohort moved on).
      sessions = sessions.filter((s) => s.sectionId === sectionId);
    } else {
      // Whole-course mode: findAllByCourseWithRecords returns every session
      // ever taken for this course, across every batch that has reused its
      // class — same cross-batch leak as getAttendanceSummary above, same
      // fix: scope to the sections that belong to whichever year is
      // relevant right now.
      const course = await courseRepository.findById(courseId);
      if (course) {
        const { targetBatchId, allClassSections } = await resolveRelevantAttendanceBatch(course.classId);
        const currentBatchSectionIds = new Set(
          allClassSections.filter((s) => s.batchId === targetBatchId).map((s) => s.id),
        );
        sessions = sessions.filter((s) => s.sectionId !== null && currentBatchSectionIds.has(s.sectionId));
        if (targetBatchId) {
          currentStudentIds = await findCurrentBatchStudentIds(course.classId, targetBatchId);
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

    let enrollments: Awaited<ReturnType<typeof enrollmentRepository.findByCourseWithStudents>>;

    if (sectionId) {
      // A specific section belongs to exactly one batch and is never
      // reused, so there's no ambiguity left to resolve — every student
      // ever enrolled in this course under that section is this section's
      // true historical roster, regardless of whether they've since been
      // promoted/transferred/graduated out (fixed 2026-08-13 — this used
      // to intersect with *currently*-enrolled students only, which
      // silently zeroed out the summary the moment a section's entire
      // cohort moved on).
      enrollments = await getSectionCourseRosterEver(courseId, sectionId);
    } else {
      enrollments = await enrollmentRepository.findByCourseWithStudents(courseId);
      // Whole-course mode: findByCourseWithStudents returns every enrollment
      // ever made for this course, across every year a batch has reused its
      // class — without this, a course between batches (current year has no
      // enrollments yet) still shows the previous batch's attendance, the
      // same cross-batch leak already fixed for assignments/quizzes. Scope
      // to whichever year is actually relevant right now, same resolution
      // listAttendanceSections uses, so the two never disagree.
      const course = await courseRepository.findById(courseId);
      if (course) {
        const { targetBatchId } = await resolveRelevantAttendanceBatch(course.classId);
        if (targetBatchId) {
          const currentBatchStudentIds = await findCurrentBatchStudentIds(course.classId, targetBatchId);
          enrollments = enrollments.filter((e) => currentBatchStudentIds.has(e.studentId));
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
