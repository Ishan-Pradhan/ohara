import type { Response } from 'express';

import type { AuthRequest } from '../types/auth.types.js';
import { attendanceSessionRepository } from '../repositories/attendanceSessions.repository.js';
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

    const sessions = await attendanceSessionRepository.findAllByCourseWithRecords(courseId);

    const points: AttendanceTrendPoint[] = sessions.map((session) => {
      const records = session.records ?? [];
      return {
        date: session.sessionDate,
        present: records.filter((r) => r.status === 'present').length,
        absent: records.filter((r) => r.status === 'absent').length,
        late: records.filter((r) => r.status === 'late').length,
        total: records.length,
      };
    });

    // Sort by date ascending
    points.sort((a, b) => a.date.localeCompare(b.date));

    return ok(res, points, 'Attendance trends retrieved');
  },
);
