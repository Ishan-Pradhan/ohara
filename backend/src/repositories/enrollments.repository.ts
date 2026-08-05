import type { Transaction } from 'sequelize';
import { sequelize } from '../config/db.js';
import { Enrollment } from '../models/enrollments.model.js';
import type { EnrollmentCreationAttributes } from '../types/placement.types.js';

export const enrollmentRepository = {
  create: async (data: EnrollmentCreationAttributes): Promise<Enrollment> => {
    return await Enrollment.create(data);
  },

  bulkCreate: async (
    data: EnrollmentCreationAttributes[],
    transaction?: Transaction,
  ): Promise<Enrollment[]> => {
    return await Enrollment.bulkCreate(data, { transaction });
  },

  findAll: async (options?: {
    studentId?: string;
    courseId?: string;
    academicYearId?: string;
  }): Promise<Enrollment[]> => {
    const where: Record<string, string> = {};
    if (options?.studentId) where.studentId = options.studentId;
    if (options?.courseId) where.courseId = options.courseId;
    if (options?.academicYearId) where.academicYearId = options.academicYearId;

    return await Enrollment.findAll({ where, order: [['createdAt', 'DESC']] });
  },

  /** Powers the FR-10 combined view (Task 4): active enrollments with course + teachers. */
  findActiveWithDetails: async (
    studentId: string,
    academicYearId: string,
  ): Promise<Enrollment[]> => {
    return await Enrollment.findAll({
      where: { studentId, academicYearId, status: 'active' },
      include: [{ association: 'course', include: ['teachers'] }],
    });
  },

  /** Powers a course's roster view (teacher/admin) — each row's `student` is included. */
  findByCourseWithStudents: async (courseId: string): Promise<Enrollment[]> => {
    return await Enrollment.findAll({
      where: { courseId },
      include: ['student'],
      order: [['createdAt', 'ASC']],
    });
  },

  /** Powers requireEnrolledStudent. Active enrollment only — a `dropped`
   * enrollment shouldn't grant tutor access. */
  isEnrolled: async (studentId: string, courseId: string): Promise<boolean> => {
    const found = await Enrollment.findOne({
      where: { studentId, courseId, status: 'active' },
    });
    return found !== null;
  },

  /** Active-enrollment headcount per course — powers the fill-vs-capacity
   * display for electives, same shape as classMembershipRepository.countBySections. */
  countByCourses: async (courseIds: string[]): Promise<Record<string, number>> => {
    if (courseIds.length === 0) return {};

    const rows = (await Enrollment.findAll({
      where: { courseId: courseIds, status: 'active' },
      attributes: ['courseId', [sequelize.fn('COUNT', sequelize.col('id')), 'count']],
      group: ['courseId'],
      raw: true,
    })) as unknown as { courseId: string; count: string }[];

    return Object.fromEntries(rows.map((r) => [r.courseId, Number(r.count)]));
  },

  /** One row per (student, course, year) by the unique constraint — powers
   * self-enroll's re-enroll-after-drop reactivation path. */
  findByStudentCourseYear: async (
    studentId: string,
    courseId: string,
    academicYearId: string,
  ): Promise<Enrollment | null> => {
    return await Enrollment.findOne({ where: { studentId, courseId, academicYearId } });
  },

  setStatus: async (
    id: string,
    status: 'active' | 'completed' | 'dropped',
  ): Promise<Enrollment | null> => {
    const enrollment = await Enrollment.findByPk(id);
    if (!enrollment) return null;
    return await enrollment.update({ status });
  },
};
