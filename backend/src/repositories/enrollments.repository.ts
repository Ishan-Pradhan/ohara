import type { Transaction } from 'sequelize';
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
};
