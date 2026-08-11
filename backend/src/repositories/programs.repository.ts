import { Program } from '../models/programs.model.js';
import type { ProgramCreationAttributes } from '../types/institution.types.js';

type ProgramUpdateAttributes = Partial<
  Pick<
    ProgramCreationAttributes,
    'name' | 'institutionType' | 'description' | 'affiliation' | 'abbreviation'
  >
>;

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

  update: async (
    id: string,
    data: ProgramUpdateAttributes,
  ): Promise<Program | null> => {
    const program = await Program.findByPk(id);
    if (!program) return null;
    return await program.update(data);
  },

  /** `classes.programId` is ON DELETE RESTRICT — a program with classes throws
   * `ForeignKeyConstraintError`, which error.middleware.ts maps to a 409. */
  delete: async (id: string): Promise<boolean> => {
    const deleted = await Program.destroy({ where: { id } });
    return deleted > 0;
  },
};
