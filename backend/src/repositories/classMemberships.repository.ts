import { sequelize } from '../config/db.js';
import { ClassMembership } from '../models/classMemberships.model.js';
import { enrollmentRepository } from './enrollments.repository.js';
import { userRepository } from './users.repository.js';
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

  /** Atomically creates the new membership (+ auto-enroll) and closes out the old one. */
  promote: async (
    oldMembershipId: string,
    newData: ClassMembershipCreationAttributes,
    outcome: ClassMembershipOutcome,
    autoEnrollCourseIds: string[] = [],
  ): Promise<ClassMembership> => {
    return await sequelize.transaction(async (transaction) => {
      const newMembership = await ClassMembership.create(newData, { transaction });

      if (autoEnrollCourseIds.length > 0) {
        const enrollments: EnrollmentCreationAttributes[] = autoEnrollCourseIds.map(
          (courseId) => ({
            studentId: newData.studentId,
            courseId,
            academicYearId: newData.academicYearId,
          }),
        );
        await enrollmentRepository.bulkCreate(enrollments, transaction);
      }

      const oldMembership = await ClassMembership.findByPk(oldMembershipId, { transaction });
      if (!oldMembership) {
        throw new Error('Class membership disappeared mid-transaction');
      }
      oldMembership.outcome = outcome;
      oldMembership.promotedToId = newMembership.id;
      await oldMembership.save({ transaction });

      return newMembership;
    });
  },

  /** Atomically graduates the student (status + cleared refresh token) and closes out the membership. */
  graduate: async (id: string, studentId: string): Promise<ClassMembership> => {
    return await sequelize.transaction(async (transaction) => {
      await userRepository.updateStatusInTransaction(studentId, 'graduated', transaction);

      const membership = await ClassMembership.findByPk(id, { transaction });
      if (!membership) {
        throw new Error('Class membership disappeared mid-transaction');
      }
      membership.outcome = 'graduated';
      membership.promotedToId = null;
      await membership.save({ transaction });

      return membership;
    });
  },
};
