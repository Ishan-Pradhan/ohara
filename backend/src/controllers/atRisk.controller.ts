import type { Response } from 'express';

import type { AuthRequest } from '../types/auth.types.js';
import { enrollmentRepository } from '../repositories/enrollments.repository.js';
import { assignmentRepository } from '../repositories/assignments.repository.js';
import { submissionRepository } from '../repositories/submissions.repository.js';
import { attendanceRecordRepository } from '../repositories/attendanceRecords.repository.js';
import { courseRepository } from '../repositories/courses.repository.js';
import { loadGradebook } from './gradebook.controller.js';
import { buildAttendancePercentage } from '../serializers/attendance.serializer.js';
import { generateText } from '../services/llm.service.js';
import {
  atRiskExplanationSystemPrompt,
  atRiskExplanationUserPrompt,
} from '../prompts/atRiskExplanation.prompt.js';
import {
  AT_RISK_MIN_AVERAGE_PERCENT,
  AT_RISK_MIN_ATTENDANCE_PERCENT,
  AT_RISK_MAX_MISSING_SUBMISSIONS,
} from '../constants/index.js';
import { asyncHandler } from '../utils/AsyncHandler.js';
import { ok } from '../utils/ApiResponse.js';
import { ApiError } from '../utils/ApiError.js';

interface StudentMetrics {
  studentId: string;
  studentName: string;
  averageGrade: number | null;
  attendancePercentage: number | null;
  missingSubmissions: number;
  lateSubmissions: number;
  isAtRisk: boolean;
}

/** FR-40: aggregates average grade (from the same gradebook math the
 * Gradebook tab uses — one source of truth for "average"), attendance %,
 * and missing/late submission counts, per enrolled student. Pure
 * computation over already-fetched data; no DB access below this line. */
const computeAtRiskMetrics = async (courseId: string): Promise<StudentMetrics[]> => {
  const [gradebook, roster, assignments, byStudentAttendance] = await Promise.all([
    loadGradebook(courseId),
    enrollmentRepository.findByCourseWithStudents(courseId),
    assignmentRepository.findAllByCourse(courseId),
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

export const getAtRiskDashboard = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { courseId } = req.validated?.params as { courseId: string };
    const metrics = await computeAtRiskMetrics(courseId);
    return ok(res, metrics, 'At-risk dashboard retrieved');
  },
);

/** FR-42: teacher-triggered, never automatic — same cost-control principle
 * as AI grading (assignmentGradingLimiter gates the route). */
export const explainAtRisk = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { courseId, studentId } = req.validated?.params as { courseId: string; studentId: string };

    const metrics = await computeAtRiskMetrics(courseId);
    const studentMetrics = metrics.find((m) => m.studentId === studentId);
    if (!studentMetrics) {
      throw new ApiError(404, 'Student not found in this course');
    }

    const course = await courseRepository.findById(courseId);

    const prompt = atRiskExplanationUserPrompt({
      studentName: studentMetrics.studentName,
      courseName: course?.title ?? 'this course',
      averageGrade: studentMetrics.averageGrade,
      attendancePercentage: studentMetrics.attendancePercentage,
      missingSubmissions: studentMetrics.missingSubmissions,
      lateSubmissions: studentMetrics.lateSubmissions,
      minAverageThreshold: AT_RISK_MIN_AVERAGE_PERCENT,
      minAttendanceThreshold: AT_RISK_MIN_ATTENDANCE_PERCENT,
      maxMissingThreshold: AT_RISK_MAX_MISSING_SUBMISSIONS,
    });
    const explanation = await generateText(atRiskExplanationSystemPrompt, prompt);

    return ok(res, { studentId, explanation: explanation.trim() }, 'Explanation generated');
  },
);
