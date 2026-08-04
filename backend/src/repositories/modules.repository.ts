import type { Transaction } from 'sequelize';
import { Module } from '../models/modules.model.js';
import { Lesson } from '../models/lessons.model.js';
import type {
  ModuleCreationAttributes,
  ModuleAttributes,
} from '../types/courseContent.types.js';

export const moduleRepository = {
  create: async (data: ModuleCreationAttributes, transaction?: Transaction): Promise<Module> => {
    return await Module.create(data, { transaction });
  },

  findAllByCourse: async (courseId: string): Promise<Module[]> => {
    return await Module.findAll({
      where: { courseId },
      order: [
        ['orderIndex', 'ASC'],
        [{ model: Lesson, as: 'lessons' }, 'orderIndex', 'ASC'],
      ],
      include: [{ model: Lesson, as: 'lessons' }],
    });
  },

  findById: async (id: string): Promise<Module | null> => {
    return await Module.findByPk(id);
  },

  /** For append-on-regenerate: new modules continue after whatever a course
   * already has, rather than colliding with existing order_index values. */
  maxOrderIndex: async (courseId: string): Promise<number> => {
    const max = await Module.max('orderIndex', { where: { courseId } });
    return typeof max === 'number' ? max : -1;
  },

  update: async (
    id: string,
    data: Partial<Pick<ModuleAttributes, 'title' | 'orderIndex'>>,
  ): Promise<Module | null> => {
    const module = await Module.findByPk(id);
    if (!module) return null;
    return await module.update(data);
  },

  /** `lessons.moduleId` is ON DELETE CASCADE. */
  delete: async (id: string): Promise<boolean> => {
    const deleted = await Module.destroy({ where: { id } });
    return deleted > 0;
  },
};
