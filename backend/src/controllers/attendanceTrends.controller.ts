import type { Response } from 'express';

import type { AuthRequest } from '../types/auth.types.js';
import { attendanceSessionRepository } from '../repositories/attendanceSessions.repository.js';
import { classMembershipRepository } from '../repositories/classMemberships.repository.js';
import { courseRepository } from '../repositories/courses.repository.js';
import { resolveRelevantAttendanceYear, findCurrentYearStudentIds } from './attendance.controller.js';
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

    // A student promoted/transferred/retained out of a section keeps their
    // attendance_records from when they were genuinely there — correct as
    // history, but counting them here would plot a departed cohort's
    // sessions right alongside (or instead of) the section's actual current
    // roster, contradicting getAttendanceSummary, which already scopes to
    // currently-enrolled students only. currentStudentIds narrows to that
    // same set; null means "no scoping resolved" (e.g. course has no
    // sections yet), in which case every record on an in-scope session counts.
    let currentStudentIds: Set<string> | null = null;

    if (sectionId) {
      // One section belongs to exactly one academic year, so this already
      // excludes every other year's sessions — same as the other
      // per-section attendance views.
      sessions = sessions.filter((s) => s.sectionId === sectionId);
      const members = await classMembershipRepository.findBySectionWithStudents(sectionId);
      currentStudentIds = new Set(members.map((m) => m.studentId));
    } else {
      // Whole-course mode: findAllByCourseWithRecords returns every session
      // ever taken for this course, across every batch that has reused its
      // class — scope to the sections that belong to whichever year is
      // relevant right now, or an old batch's sessions plot right alongside
      // the current one.
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
