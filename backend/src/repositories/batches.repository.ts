import { Batch } from '../models/batches.model.js';
import type { BatchCreationAttributes } from '../types/institution.types.js';

export const batchRepository = {
  create: async (data: BatchCreationAttributes): Promise<Batch> => {
    return await Batch.create(data);
  },

  findAll: async (options?: { programId?: string }): Promise<Batch[]> => {
    const where = options?.programId ? { programId: options.programId } : {};
    return await Batch.findAll({ where, order: [['name', 'ASC']] });
  },

  findById: async (id: string): Promise<Batch | null> => {
    return await Batch.findByPk(id);
  },

  findByIds: async (ids: string[]): Promise<Batch[]> => {
    if (ids.length === 0) return [];
    return await Batch.findAll({ where: { id: ids }, order: [['name', 'ASC']] });
  },

  update: async (
    id: string,
    data: Partial<Pick<BatchCreationAttributes, 'name'>>,
  ): Promise<Batch | null> => {
    const batch = await Batch.findByPk(id);
    if (!batch) return null;
    return await batch.update(data);
  },

  /** `class_memberships.batchId` is ON DELETE RESTRICT — a batch with any
   * student placed under it throws `ForeignKeyConstraintError`, mapped to a 409. */
  delete: async (id: string): Promise<boolean> => {
    const deleted = await Batch.destroy({ where: { id } });
    return deleted > 0;
  },
};
