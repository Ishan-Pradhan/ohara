import type { Response } from 'express';

import type { AuthRequest } from '../types/auth.types.js';
import { loadGradebook } from './gradebook.controller.js';
import { enrollmentRepository } from '../repositories/enrollments.repository.js';
import { assignmentRepository } from '../repositories/assignments.repository.js';
import { submissionRepository } from '../repositories/submissions.repository.js';
import { attendanceRecordRepository } from '../repositories/attendanceRecords.repository.js';
import { buildAttendancePercentage } from '../serializers/attendance.serializer.js';
import { resolveCurrentBatchForCourseOrNull, resolveBatchForCourse } from './courses.controller.js';
import {
  AT_RISK_MIN_AVERAGE_PERCENT,
  AT_RISK_MIN_ATTENDANCE_PERCENT,
  AT_RISK_MAX_MISSING_SUBMISSIONS,
} from '../constants/index.js';
import { asyncHandler } from '../utils/AsyncHandler.js';
import { ok } from '../utils/ApiResponse.js';

export interface StudentMetrics {
  studentId: string;
  studentName: string;
  averageGrade: number | null;
  attendancePercentage: number | null;
  missingSubmissions: number;
  lateSubmissions: number;
  isAtRisk: boolean;
}

/** Shared computation reused by class intelligence and at-risk controllers.
 * `batchId` omitted -> the course's current batch (unchanged default).
 * Given -> a specific past batch's metrics (viewing completed-course
 * history — see docs/superpowers/specs/2026-08-13-completed-course-history-design.md).
 * Attendance isn't batch-filtered here since countByStatusForCourse is
 * already keyed per-student across all of a course's sessions — a student
 * only ever appears under the section(s)/batch they actually attended in,
 * so it's precise regardless. */
export const computeCourseMetrics = async (courseId: string, batchId?: string): Promise<StudentMetrics[]> => {
  const batch = batchId
    ? await resolveBatchForCourse(courseId, batchId)
    : await resolveCurrentBatchForCourseOrNull(courseId);
  const [gradebook, roster, assignments, byStudentAttendance] = await Promise.all([
    loadGradebook(courseId, batchId),
    batchId
      ? enrollmentRepository.findByCourseAndBatchWithStudents(courseId, batchId)
      : enrollmentRepository.findByCourseWithStudents(courseId),
    batch ? assignmentRepository.findAllByCourse(courseId, batch.id) : Promise.resolve([]),
    attendanceRecordRepository.countByStatusForCourse(courseId),
  ]);

  const submissionsByAssignment = await Promise.all(
    assignments.map((a) => submissionRepository.findAllByAssignment(a.id)),
  );

  const missingByStudent = new Map<string, number>();
  const lateByStudent = new Map<string, number>();
  const now = new Date();

  assignments.forEach((assignment, index) => {
    const submissions = submissionsByAssignment[index] ?? [];
    const submittedIds = new Set(submissions.map((s) => s.studentId));
    if (assignment.dueAt < now) {
      for (const { studentId } of roster) {
        if (!submittedIds.has(studentId)) {
          missingByStudent.set(studentId, (missingByStudent.get(studentId) ?? 0) + 1);
        }
      }
    }
    for (const submission of submissions) {
      if (submission.isLate) {
        lateByStudent.set(submission.studentId, (lateByStudent.get(submission.studentId) ?? 0) + 1);
      }
    }
  });

  return roster.map(({ studentId, student }) => {
    const averageGrade = gradebook.rows.find((r) => r.studentId === studentId)?.average ?? null;
    const attendancePercentage = buildAttendancePercentage(byStudentAttendance[studentId] ?? []).percentage;
    const missingSubmissions = missingByStudent.get(studentId) ?? 0;
    const lateSubmissions = lateByStudent.get(studentId) ?? 0;

    const isAtRisk =
      (averageGrade !== null && averageGrade < AT_RISK_MIN_AVERAGE_PERCENT) ||
      (attendancePercentage !== null && attendancePercentage < AT_RISK_MIN_ATTENDANCE_PERCENT) ||
      missingSubmissions >= AT_RISK_MAX_MISSING_SUBMISSIONS;

    return {
      studentId,
      studentName: student?.name ?? 'Unknown student',
      averageGrade,
      attendancePercentage,
      missingSubmissions,
      lateSubmissions,
      isAtRisk,
    };
  });
};

/** Compute submission completion rate: submitted / total required (past-due only). */
const computeSubmissionRate = async (
  courseId: string,
  rosterLength: number,
): Promise<number | null> => {
  const batch = await resolveCurrentBatchForCourseOrNull(courseId);
  const assignments = batch ? await assignmentRepository.findAllByCourse(courseId, batch.id) : [];
  const now = new Date();
  const pastDueAssignments = assignments.filter((a) => a.dueAt < now);
  if (pastDueAssignments.length === 0 || rosterLength === 0) return null;

  const submissionsByAssignment = await Promise.all(
    pastDueAssignments.map((a) => submissionRepository.findAllByAssignment(a.id)),
  );

  let totalRequired = 0;
  let totalSubmitted = 0;
  submissionsByAssignment.forEach((subs) => {
    totalRequired += rosterLength;
    totalSubmitted += subs.length;
  });

  return totalRequired > 0 ? (totalSubmitted / totalRequired) * 100 : null;
};

export const getClassIntelligence = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { courseId } = req.validated?.params as { courseId: string };

    const [metrics, roster, byStudentAttendance] = await Promise.all([
      computeCourseMetrics(courseId),
      enrollmentRepository.findByCourseWithStudents(courseId),
      attendanceRecordRepository.countByStatusForCourse(courseId),
    ]);

    const activeStudents = roster.filter((e) => e.student?.status === 'active').length;
    const averages = metrics.filter((m) => m.averageGrade !== null).map((m) => m.averageGrade as number);
    const classAverage = averages.length > 0 ? averages.reduce((a, b) => a + b, 0) / averages.length : null;

    const attendancePercentages = roster
      .map(({ studentId }) => buildAttendancePercentage(byStudentAttendance[studentId] ?? []).percentage)
      .filter((p): p is number => p !== null);
    const attendanceRate = attendancePercentages.length > 0
      ? attendancePercentages.reduce((a, b) => a + b, 0) / attendancePercentages.length
      : null;

    const submissionCompletionRate = await computeSubmissionRate(courseId, roster.length);
    const atRiskCount = metrics.filter((m) => m.isAtRisk).length;

    const sorted = metrics
      .filter((m) => m.averageGrade !== null)
      .sort((a, b) => (b.averageGrade as number) - (a.averageGrade as number));

    const topPerformers = sorted.slice(0, 5).map((m) => ({
      studentId: m.studentId,
      studentName: m.studentName,
      average: m.averageGrade as number,
    }));

    const bottomPerformers = sorted.slice(-5).reverse().map((m) => ({
      studentId: m.studentId,
      studentName: m.studentName,
      average: m.averageGrade as number,
    }));

    return ok(
      res,
      {
        courseId,
        enrollmentCount: roster.length,
        activeStudents,
        classAverage,
        attendanceRate,
        submissionCompletionRate,
        atRiskCount,
        topPerformers,
        bottomPerformers,
      },
      'Class intelligence retrieved',
    );
  },
);
