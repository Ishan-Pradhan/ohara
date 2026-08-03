import { Program } from '../models/programs.model.js';
import type { ProgramCreationAttributes } from '../types/institution.types.js';

export const programRepository = {
  create: async (data: ProgramCreationAttributes): Promise<Program> => {
    return await Program.create(data);
  },

  findAll: async (): Promise<Program[]> => {
    return await Program.findAll({ order: [['createdAt', 'DESC']] });
  },

  findById: async (id: string): Promise<Program | null> => {
    return await Program.findByPk(id);
  },
};
