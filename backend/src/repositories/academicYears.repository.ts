import { sequelize } from '../config/db.js';
import { AcademicYear } from '../models/academicYears.model.js';
import type { AcademicYearCreationAttributes } from '../types/institution.types.js';

export const academicYearRepository = {
  /**
   * Plain insert unless `isCurrent: true` is requested, in which case the
   * previous current year is unset and the new row inserted as current in one
   * transaction — the partial unique index in the migration is the backstop,
   * not the primary mechanism.
   */
  create: async (
    data: AcademicYearCreationAttributes,
  ): Promise<AcademicYear> => {
    if (!data.isCurrent) {
      return await AcademicYear.create(data);
    }

    return await sequelize.transaction(async (transaction) => {
      await AcademicYear.update(
        { isCurrent: false },
        { where: { isCurrent: true }, transaction },
      );
      return await AcademicYear.create(data, { transaction });
    });
  },

  findAll: async (): Promise<AcademicYear[]> => {
    return await AcademicYear.findAll({ order: [['startDate', 'DESC']] });
  },

  findById: async (id: string): Promise<AcademicYear | null> => {
    return await AcademicYear.findByPk(id);
  },

  /** Same current-year invariant as `create`: flipping `isCurrent` to true
   * unsets whichever row previously held it, in one transaction. */
  update: async (
    id: string,
    data: Partial<
      Pick<AcademicYearCreationAttributes, 'name' | 'startDate' | 'endDate' | 'isCurrent'>
    >,
  ): Promise<AcademicYear | null> => {
    if (!data.isCurrent) {
      const year = await AcademicYear.findByPk(id);
      if (!year) return null;
      return await year.update(data);
    }

    return await sequelize.transaction(async (transaction) => {
      const year = await AcademicYear.findByPk(id, { transaction });
      if (!year) return null;
      await AcademicYear.update(
        { isCurrent: false },
        { where: { isCurrent: true }, transaction },
      );
      return await year.update(data, { transaction });
    });
  },

  /** `sections`, `class_memberships` and `enrollments` all reference
   * `academicYearId` with ON DELETE RESTRICT — any of them existing throws
   * `ForeignKeyConstraintError`, mapped to a 409. */
  delete: async (id: string): Promise<boolean> => {
    const deleted = await AcademicYear.destroy({ where: { id } });
    return deleted > 0;
  },
};
