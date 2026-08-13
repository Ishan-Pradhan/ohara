import { Op } from 'sequelize';
import { Section } from '../models/sections.model.js';
import { ClassMembership } from '../models/classMemberships.model.js';
import type { SectionCreationAttributes } from '../types/institution.types.js';

export const sectionRepository = {
  create: async (data: SectionCreationAttributes): Promise<Section> => {
    return await Section.create(data);
  },

  /** `batchId`, when given, scopes to sections that have ever actually held
   * this batch's students — every section from its full promotion history,
   * not just the current one (design decision 2026-08-12 — browsing a
   * batch's past semesters, e.g. to review old attendance or correct a past
   * transcript entry, is a real need; see `classRepository.findAll`'s
   * matching comment). Combine with `classId` to narrow to one specific
   * semester's section(s) — normally exactly one, except a retained batch
   * that repeated that class shows up as two, one per academic year
   * attempt. Does NOT fall back to "every section" when the batch has no
   * placements at all: a batch with nothing ever placed under it has no
   * sections, full stop — silently falling back would leak a *different*
   * batch's real roster into a screen the admin explicitly scoped to this
   * one (the original bug this scoping fixes, 2026-08-12: selecting an
   * empty batch surfaced another batch's populated section with no
   * indication it belonged to someone else). */
  findAll: async (options?: {
    classId?: string;
    academicYearId?: string;
    batchId?: string;
  }): Promise<Section[]> => {
    const where: Record<string, unknown> = {};
    if (options?.classId) where.classId = options.classId;
    if (options?.academicYearId) where.academicYearId = options.academicYearId;

    if (options?.batchId) {
      const memberships = await ClassMembership.findAll({
        where: { batchId: options.batchId },
        attributes: ['sectionId'],
      });
      const sectionIds = [...new Set(memberships.map((m) => m.sectionId))];
      where.id = { [Op.in]: sectionIds };
    }

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
