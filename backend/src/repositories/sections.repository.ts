import { Section } from '../models/sections.model.js';
import type { SectionCreationAttributes } from '../types/institution.types.js';

export const sectionRepository = {
  create: async (data: SectionCreationAttributes): Promise<Section> => {
    return await Section.create(data);
  },

  findAll: async (options?: {
    classId?: string;
    academicYearId?: string;
  }): Promise<Section[]> => {
    const where: Record<string, string> = {};
    if (options?.classId) where.classId = options.classId;
    if (options?.academicYearId) where.academicYearId = options.academicYearId;

    return await Section.findAll({ where, order: [['name', 'ASC']] });
  },

  findById: async (id: string): Promise<Section | null> => {
    return await Section.findByPk(id);
  },
};
