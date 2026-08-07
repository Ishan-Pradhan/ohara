import type { Response } from 'express';

import type { AuthRequest } from '../types/auth.types.js';
import { examMarkRepository } from '../repositories/examMarks.repository.js';
import { examTermRepository } from '../repositories/examTerms.repository.js';
import { enrollmentRepository } from '../repositories/enrollments.repository.js';
import { buildCourseExamMarkRows } from '../serializers/examMark.serializer.js';
import { asyncHandler } from '../utils/AsyncHandler.js';
import { ok } from '../utils/ApiResponse.js';
import { ApiError } from '../utils/ApiError.js';

const getRoster = async (courseId: string) => {
  const enrollments = await enrollmentRepository.findByCourseWithStudents(courseId);
  return enrollments.map((e) => ({ studentId: e.studentId, studentName: e.student?.name ?? 'Unknown student' }));
};

/** Every mark's studentId must belong to the course roster — never trust
 * the client to only send actually-enrolled students (same guard as
 * attendance's assertRosterCoverage). */
const assertRosterCoverage = (
  roster: { studentId: string }[],
  marks: { studentId: string }[],
) => {
  const rosterIds = new Set(roster.map((r) => r.studentId));
  for (const m of marks) {
    if (!rosterIds.has(m.studentId)) {
      throw new ApiError(400, `Student ${m.studentId} is not enrolled in this course`);
    }
  }
};

export const getCourseExamMarks = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { courseId, examTermId } = req.validated?.params as { courseId: string; examTermId: string };

    const term = await examTermRepository.findById(examTermId);
    if (!term) {
      throw new ApiError(404, 'Exam term not found');
    }

    const roster = await getRoster(courseId);
    const existing = await examMarkRepository.findByCourseAndTerm(courseId, examTermId);
    return ok(res, buildCourseExamMarkRows(roster, existing), 'Exam marks retrieved');
  },
);

export const upsertCourseExamMarks = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { courseId, examTermId } = req.validated?.params as { courseId: string; examTermId: string };
    const { marks } = req.validated?.body as {
      marks: { studentId: string; marksObtained: number; maxMarks: number }[];
    };
    const enteredBy = req.user?.id;
    if (!enteredBy) {
      throw new ApiError(401, 'Unauthorized');
    }

    const term = await examTermRepository.findById(examTermId);
    if (!term) {
      throw new ApiError(404, 'Exam term not found');
    }

    const roster = await getRoster(courseId);
    assertRosterCoverage(roster, marks);

    await examMarkRepository.deleteByCourseAndTerm(courseId, examTermId);
    await examMarkRepository.bulkCreate(
      marks.map((m) => ({
        examTermId,
        courseId,
        studentId: m.studentId,
        marksObtained: m.marksObtained,
        maxMarks: m.maxMarks,
        enteredBy,
      })),
    );

    const existing = await examMarkRepository.findByCourseAndTerm(courseId, examTermId);
    return ok(res, buildCourseExamMarkRows(roster, existing), 'Exam marks saved');
  },
);
