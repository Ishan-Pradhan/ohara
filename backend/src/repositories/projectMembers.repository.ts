import type { Transaction } from 'sequelize';
import { ProjectMember } from '../models/projectMembers.model.js';
import type { ProjectMemberCreationAttributes } from '../types/kanban.types.js';

export const projectMemberRepository = {
  bulkCreate: async (
    data: ProjectMemberCreationAttributes[],
    transaction?: Transaction,
  ): Promise<ProjectMember[]> => {
    if (data.length === 0) return [];
    return await ProjectMember.bulkCreate(data, { transaction });
  },

  findByProject: async (projectId: string): Promise<ProjectMember[]> => {
    return await ProjectMember.findAll({ where: { projectId }, include: ['student'] });
  },

  isMember: async (projectId: string, studentId: string): Promise<boolean> => {
    const found = await ProjectMember.findOne({ where: { projectId, studentId } });
    return found !== null;
  },

  /** Replaces the full roster in one go — same delete-then-recreate pattern
   * as attendance/exam-marks, so re-submitting a membership list never
   * fights the unique (projectId, studentId) constraint. */
  replaceForProject: async (
    projectId: string,
    studentIds: string[],
    transaction?: Transaction,
  ): Promise<void> => {
    await ProjectMember.destroy({ where: { projectId }, transaction });
    if (studentIds.length === 0) return;
    await ProjectMember.bulkCreate(
      studentIds.map((studentId) => ({ projectId, studentId })),
      { transaction },
    );
  },
};
