import type { Response } from 'express';

import type { AuthRequest } from '../types/auth.types.js';
import { attendanceSessionRepository } from '../repositories/attendanceSessions.repository.js';
import { courseRepository } from '../repositories/courses.repository.js';
import { resolveRelevantAttendanceBatch, findCurrentBatchStudentIds } from './attendance.controller.js';
import { asyncHandler } from '../utils/AsyncHandler.js';
import { ok } from '../utils/ApiResponse.js';

interface AttendanceTrendPoint {
  date: string;
  present: number;
  absent: number;
  late: number;
  total: number;
}

export const getAttendanceTrends = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { courseId } = req.validated?.params as { courseId: string };
    const { sectionId } = (req.validated?.query as { sectionId?: string }) ?? {};

    let sessions = await attendanceSessionRepository.findAllByCourseWithRecords(courseId);

    // currentStudentIds narrows plotted records to a resolved batch's
    // students; null means "no scoping needed," in which case every record
    // on an in-scope session counts.
    let currentStudentIds: Set<string> | null = null;

    if (sectionId) {
      // One section belongs to exactly one batch, and is never reused, so
      // this already excludes every other batch's sessions with no
      // ambiguity left to resolve — every record on a session recorded here
      // legitimately belongs to this section's history, regardless of
      // whether its students have since been promoted/transferred/
      // graduated out (fixed 2026-08-13 — this used to also narrow to
      // *currently*-enrolled students, which silently zeroed out the whole
      // chart the moment a section's entire cohort moved on).
      sessions = sessions.filter((s) => s.sectionId === sectionId);
    } else {
      // Whole-course mode: findAllByCourseWithRecords returns every session
      // ever taken for this course, across every batch that has reused its
      // class — scope to the sections that belong to whichever year is
      // relevant right now, or an old batch's sessions plot right alongside
      // the current one.
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

    const points: AttendanceTrendPoint[] = sessions
      .map((session) => {
        const records = (session.records ?? []).filter(
          (r) => currentStudentIds === null || currentStudentIds.has(r.studentId),
        );
        return {
          date: session.sessionDate,
          present: records.filter((r) => r.status === 'present').length,
          absent: records.filter((r) => r.status === 'absent').length,
          late: records.filter((r) => r.status === 'late').length,
          total: records.length,
        };
      })
      // A session where every record belonged to a since-departed student
      // isn't a current data point — drop it rather than plot a hollow
      // zero-everything bar for a date with no currently-relevant activity.
      .filter((point) => point.total > 0);

    // Sort by date ascending
    points.sort((a, b) => a.date.localeCompare(b.date));

    return ok(res, points, 'Attendance trends retrieved');
  },
);
