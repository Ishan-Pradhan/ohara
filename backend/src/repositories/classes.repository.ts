import { Op } from 'sequelize';
import { Class } from '../models/classes.model.js';
import { ClassMembership } from '../models/classMemberships.model.js';
import type { ClassCreationAttributes } from '../types/institution.types.js';

type ClassUpdateAttributes = Partial<
  Pick<ClassCreationAttributes, 'name' | 'orderIndex'>
>;

export const classRepository = {
  create: async (data: ClassCreationAttributes): Promise<Class> => {
    return await Class.create(data);
  },

  findAll: async (options?: { programId?: string; batchId?: string }): Promise<Class[]> => {
    const where: Record<string, unknown> = {};
    if (options?.programId) where.programId = options.programId;

    // When batchId is provided, filter to only classes that have sections
    // with ClassMembership records for that batch. If no matches, fall back
    // to all classes for the program (batch may not have placements yet).
    if (options?.batchId) {
      const memberships = await ClassMembership.findAll({
        where: { batchId: options.batchId },
        attributes: ['sectionId'],
        include: [{ association: 'section', attributes: ['classId'], required: true }],
      });
      const classIds = [...new Set(memberships.map((m) => m.section?.classId).filter(Boolean))] as string[];
      if (classIds.length > 0) {
        where.id = { [Op.in]: classIds };
      }
    }

    return await Class.findAll({ where, order: [['orderIndex', 'ASC']] });
  },

  findById: async (id: string): Promise<Class | null> => {
    return await Class.findByPk(id);
  },

  /** Powers events.controller.ts's teacher-scope resolution — needs the
   * class's program (for institutionType) without changing findById's
   * existing no-include contract for its other callers. */
  findByIdWithProgram: async (id: string): Promise<Class | null> => {
    return await Class.findByPk(id, { include: ['program'] });
  },

  update: async (
    id: string,
    data: ClassUpdateAttributes,
  ): Promise<Class | null> => {
    const cls = await Class.findByPk(id);
    if (!cls) return null;
    return await cls.update(data);
  },

  /** `sections.classId` and `courses.classId` are ON DELETE RESTRICT — a class
   * with either throws `ForeignKeyConstraintError`, mapped to a 409. */
  delete: async (id: string): Promise<boolean> => {
    const deleted = await Class.destroy({ where: { id } });
    return deleted > 0;
  },
};
