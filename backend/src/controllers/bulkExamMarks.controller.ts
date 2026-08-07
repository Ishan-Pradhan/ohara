import type { Response } from 'express';

import type { AuthRequest } from '../types/auth.types.js';
import { ClassMembership } from '../models/classMemberships.model.js';
import { Course } from '../models/courses.model.js';
import { ExamMark } from '../models/examMarks.model.js';
import { ExamTerm } from '../models/examTerms.model.js';
import { asyncHandler } from '../utils/AsyncHandler.js';
import { ok } from '../utils/ApiResponse.js';
import { ApiError } from '../utils/ApiError.js';

export const getBulkExamMarks = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { classId, batchId, examTermId } = req.validated?.query as {
      classId: string;
      batchId: string;
      examTermId: string;
    };

    const term = await ExamTerm.findByPk(examTermId);
    if (!term) {
      throw new ApiError(404, 'Exam term not found');
    }

    // 1. Get all students in that class (semester) and batch
    const placements = await ClassMembership.findAll({
      where: { batchId },
      include: [
        {
          association: 'section',
          where: { classId },
          required: true,
        },
        {
          association: 'student',
          required: true,
        },
      ],
    });

    const students = placements
      .map((p) => ({
        id: p.student!.id,
        name: p.student!.name,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    // 2. Get all courses for that class (semester)
    const courses = await Course.findAll({
      where: { classId },
      order: [['title', 'ASC']],
    });

    // 3. Get existing exam marks for these students and courses
    const studentIds = students.map((s) => s.id);
    const courseIds = courses.map((c) => c.id);

    const marks =
      studentIds.length > 0 && courseIds.length > 0
        ? await ExamMark.findAll({
            where: {
              examTermId,
              studentId: studentIds,
              courseId: courseIds,
            },
          })
        : [];

    return ok(
      res,
      {
        students,
        courses: courses.map((c) => ({ id: c.id, title: c.title })),
        marks: marks.map((m) => ({
          studentId: m.studentId,
          courseId: m.courseId,
          marksObtained: Number(m.marksObtained),
          maxMarks: Number(m.maxMarks),
        })),
      },
      'Bulk exam marks retrieved',
    );
  },
);

export const upsertBulkExamMarks = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { examTermId, marks } = req.validated?.body as {
      examTermId: string;
      marks: { studentId: string; courseId: string; marksObtained: number; maxMarks: number }[];
    };
    const enteredBy = req.user?.id;
    if (!enteredBy) {
      throw new ApiError(401, 'Unauthorized');
    }

    const term = await ExamTerm.findByPk(examTermId);
    if (!term) {
      throw new ApiError(404, 'Exam term not found');
    }

    if (marks.length === 0) {
      return ok(res, { success: true }, 'No marks provided');
    }

    const studentIds = [...new Set(marks.map((m) => m.studentId))];
    const courseIds = [...new Set(marks.map((m) => m.courseId))];

    // Delete existing marks for this subset of students, courses, and exam term
    await ExamMark.destroy({
      where: {
        examTermId,
        studentId: studentIds,
        courseId: courseIds,
      },
    });

    // Bulk create
    await ExamMark.bulkCreate(
      marks.map((m) => ({
        examTermId,
        courseId: m.courseId,
        studentId: m.studentId,
        marksObtained: m.marksObtained,
        maxMarks: m.maxMarks,
        enteredBy,
      })),
    );

    return ok(res, { success: true }, 'Bulk exam marks saved successfully');
  },
);
