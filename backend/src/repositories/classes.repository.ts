import { Class } from '../models/classes.model.js';
import type { ClassCreationAttributes } from '../types/institution.types.js';

export const classRepository = {
  create: async (data: ClassCreationAttributes): Promise<Class> => {
    return await Class.create(data);
  },

  findAll: async (options?: { programId?: string }): Promise<Class[]> => {
    const where = options?.programId ? { programId: options.programId } : {};
    return await Class.findAll({ where, order: [['orderIndex', 'ASC']] });
  },

  findById: async (id: string): Promise<Class | null> => {
    return await Class.findByPk(id);
  },
};
