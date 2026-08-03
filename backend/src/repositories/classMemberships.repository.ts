import { sequelize } from '../config/db.js';
import { ClassMembership } from '../models/classMemberships.model.js';
import { enrollmentRepository } from './enrollments.repository.js';
import type {
  ClassMembershipCreationAttributes,
  ClassMembershipOutcome,
  EnrollmentCreationAttributes,
} from '../types/placement.types.js';

export const classMembershipRepository = {
  /**
   * Creates the placement and, if `autoEnrollCourseIds` is non-empty, bulk-creates one
   * `active` enrollment per course in the same transaction. `autoEnrollCourseIds` is resolved
   * by the controller (courseRepository.findAll({classId}) when the program is a school)
   * before calling this — the institutionType branch stays in the controller; this method only
   * knows "create a membership, optionally with these enrollments, atomically."
   */
  create: async (
    data: ClassMembershipCreationAttributes,
    autoEnrollCourseIds: string[] = [],
  ): Promise<ClassMembership> => {
    return await sequelize.transaction(async (transaction) => {
      const membership = await ClassMembership.create(data, { transaction });

      if (autoEnrollCourseIds.length > 0) {
        const enrollments: EnrollmentCreationAttributes[] = autoEnrollCourseIds.map(
          (courseId) => ({
            studentId: data.studentId,
            courseId,
            academicYearId: data.academicYearId,
          }),
        );
        await enrollmentRepository.bulkCreate(enrollments, transaction);
      }

      return membership;
    });
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

  /** Powers the FR-10 combined view (Task 4): one deep-included row per (student, year). */
  findCurrentWithDetails: async (
    studentId: string,
    currentAcademicYearId: string,
  ): Promise<ClassMembership | null> => {
    return await ClassMembership.findOne({
      where: { studentId, academicYearId: currentAcademicYearId },
      include: [
        {
          association: 'section',
          include: [{ association: 'class', include: ['program'] }],
        },
        'academicYear',
      ],
    });
  },

  findById: async (id: string): Promise<ClassMembership | null> => {
    return await ClassMembership.findByPk(id);
  },

  updateSection: async (id: string, sectionId: string): Promise<ClassMembership | null> => {
    const membership = await ClassMembership.findByPk(id);
    if (!membership) return null;
    membership.sectionId = sectionId;
    await membership.save();
    return membership;
  },

  setOutcome: async (
    id: string,
    outcome: ClassMembershipOutcome,
    promotedToId: string | null,
  ): Promise<ClassMembership | null> => {
    const membership = await ClassMembership.findByPk(id);
    if (!membership) return null;
    membership.outcome = outcome;
    membership.promotedToId = promotedToId;
    await membership.save();
    return membership;
  },
};
