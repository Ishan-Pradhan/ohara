import type { Response } from 'express';

import type { AuthRequest } from '../types/auth.types.js';
import { userRepository } from '../repositories/users.repository.js';
import { classMembershipRepository } from '../repositories/classMemberships.repository.js';
import { enrollmentRepository } from '../repositories/enrollments.repository.js';
import { attendanceRecordRepository } from '../repositories/attendanceRecords.repository.js';
import { institutionProfileRepository } from '../repositories/institutionProfile.repository.js';
import { loadGradebook } from './gradebook.controller.js';
import { buildAttendancePercentage } from '../serializers/attendance.serializer.js';
import { generateReportCardPdf, type ReportCardCourseRow } from '../services/reportCardPdf.service.js';
import { asyncHandler } from '../utils/AsyncHandler.js';
import { ApiError } from '../utils/ApiError.js';

/** A → F letter grade from a percentage average — FR-31's "grade" alongside
 * the numeric total/average. No partial credit for missing courses: `null`
 * (no graded work anywhere yet) becomes 'N/A', not a zero. */
const letterGrade = (average: number | null): string => {
  if (average === null) return 'N/A';
  if (average >= 90) return 'A';
  if (average >= 80) return 'B';
  if (average >= 70) return 'C';
  if (average >= 60) return 'D';
  return 'F';
};

const average = (values: number[]): number | null =>
  values.length > 0 ? values.reduce((sum, v) => sum + v, 0) / values.length : null;

export const getReportCard = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { studentId } = req.validated?.params as { studentId: string };
    const user = req.user;
    if (!user) {
      throw new ApiError(401, 'Unauthorized');
    }

    const student = await userRepository.findById(studentId);
    if (!student || student.role !== 'student') {
      throw new ApiError(404, 'Student not found');
    }

    const membership = await classMembershipRepository.findCurrent(studentId);
    if (!membership) {
      throw new ApiError(404, 'Student is not currently placed');
    }

    const enrollments = await enrollmentRepository.findActiveWithDetails(studentId, membership.academicYearId);

    const isAdmin = user.role === 'admin';
    const isSelf = user.id === studentId;
    const isTeachingTeacher =
      user.role === 'teacher' &&
      enrollments.some((e) => (e.course?.teachers ?? []).some((t) => t.id === user.id));
    if (!isAdmin && !isSelf && !isTeachingTeacher) {
      throw new ApiError(403, "Not authorized to view this student's report card");
    }

    const courses: ReportCardCourseRow[] = [];
    for (const enrollment of enrollments) {
      const course = enrollment.course;
      if (!course) continue;

      const gradebook = await loadGradebook(course.id);
      const row = gradebook.rows.find((r) => r.studentId === studentId);

      const attendanceRecords = await attendanceRecordRepository.findByStudentAndCourse(studentId, course.id);
      const attendancePercentage = buildAttendancePercentage(
        attendanceRecords.map((r) => ({ status: r.status })),
      ).percentage;

      courses.push({
        courseTitle: course.title,
        score: row?.totalScore ?? 0,
        maxScore: row?.totalMaxScore ?? 0,
        average: row?.average ?? null,
        attendancePercentage,
      });
    }

    const overallAverage = average(courses.map((c) => c.average).filter((a): a is number => a !== null));
    const overallAttendance = average(
      courses.map((c) => c.attendancePercentage).filter((a): a is number => a !== null),
    );

    const institution = await institutionProfileRepository.get();

    const pdf = await generateReportCardPdf({
      institutionName: institution?.name ?? 'Ohara',
      studentName: student.name,
      programName: membership.section?.class?.program?.name ?? '—',
      className: membership.section?.class?.name ?? '—',
      sectionName: membership.section?.name ?? '—',
      academicYearName: membership.academicYear?.name ?? '—',
      courses,
      overallAverage,
      overallAttendance,
      overallGrade: letterGrade(overallAverage),
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="report-card-${student.name.replace(/[^a-zA-Z0-9]/g, '-')}.pdf"`,
    );
    res.send(pdf);
  },
);
