import { ClassMembership } from '../models/classMemberships.model.js';
import type { ClassMembershipCreationAttributes } from '../types/placement.types.js';

export const classMembershipRepository = {
  create: async (data: ClassMembershipCreationAttributes): Promise<ClassMembership> => {
    return await ClassMembership.create(data);
  },

  findAll: async (options?: {
    studentId?: string;
    sectionId?: string;
    academicYearId?: string;
  }): Promise<ClassMembership[]> => {
    const where: Record<string, string> = {};
    if (options?.studentId) where.studentId = options.studentId;
    if (options?.sectionId) where.sectionId = options.sectionId;
    if (options?.academicYearId) where.academicYearId = options.academicYearId;

    return await ClassMembership.findAll({ where, order: [['createdAt', 'DESC']] });
  },

  findByStudentAndYear: async (
    studentId: string,
    academicYearId: string,
  ): Promise<ClassMembership | null> => {
    return await ClassMembership.findOne({ where: { studentId, academicYearId } });
  },
};
