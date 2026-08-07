import { ExamMark } from '../models/examMarks.model.js';
import type { ExamMarkCreationAttributes } from '../types/examMarks.types.js';

export const examMarkRepository = {
  bulkCreate: async (data: ExamMarkCreationAttributes[]): Promise<ExamMark[]> => {
    if (data.length === 0) return [];
    return await ExamMark.bulkCreate(data);
  },

  /** Same replace-the-set pattern as attendance sessions: a re-submit of
   * the marks-entry form deletes and recreates rather than diffing rows,
   * which sidesteps upsert races and keeps the unique (term, course,
   * student) constraint trivially satisfied. */
  deleteByCourseAndTerm: async (courseId: string, examTermId: string): Promise<void> => {
    await ExamMark.destroy({ where: { courseId, examTermId } });
  },

  findByCourseAndTerm: async (courseId: string, examTermId: string): Promise<ExamMark[]> => {
    return await ExamMark.findAll({
      where: { courseId, examTermId },
      include: ['student'],
    });
  },

  /** Every mark ever entered for a student, across every course and exam
   * term — the raw input to the report card. */
  findByStudent: async (studentId: string): Promise<ExamMark[]> => {
    return await ExamMark.findAll({
      where: { studentId },
      include: [
        {
          association: 'course',
          include: ['class'],
        },
        {
          association: 'examTerm',
          include: ['academicYear'],
        },
      ],
      order: [['createdAt', 'ASC']],
    });
  },
};
