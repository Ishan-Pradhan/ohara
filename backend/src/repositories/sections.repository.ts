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

  /** Powers "My Section" — a class teacher is assigned to at most one section
   * at a time in practice, but this returns every section they're assigned to
   * (e.g. across years) in case that ever isn't true. */
  findByClassTeacherId: async (classTeacherId: string): Promise<Section[]> => {
    return await Section.findAll({ where: { classTeacherId } });
  },

  update: async (
    id: string,
    data: Partial<Pick<SectionCreationAttributes, 'name' | 'classTeacherId' | 'capacity'>>,
  ): Promise<Section | null> => {
    const section = await Section.findByPk(id);
    if (!section) return null;
    return await section.update(data);
  },

  /** `class_memberships.sectionId` is ON DELETE RESTRICT — a section with
   * students placed in it throws `ForeignKeyConstraintError`, mapped to a 409. */
  delete: async (id: string): Promise<boolean> => {
    const deleted = await Section.destroy({ where: { id } });
    return deleted > 0;
  },
};
