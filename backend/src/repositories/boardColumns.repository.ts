import type { Transaction } from 'sequelize';
import { BoardColumn } from '../models/boardColumns.model.js';
import type { BoardColumnCreationAttributes } from '../types/kanban.types.js';

export const boardColumnRepository = {
  create: async (data: BoardColumnCreationAttributes): Promise<BoardColumn> => {
    return await BoardColumn.create(data);
  },

  bulkCreate: async (
    data: BoardColumnCreationAttributes[],
    transaction?: Transaction,
  ): Promise<BoardColumn[]> => {
    return await BoardColumn.bulkCreate(data, { transaction });
  },

  findByProject: async (projectId: string): Promise<BoardColumn[]> => {
    return await BoardColumn.findAll({ where: { projectId }, order: [['orderIndex', 'ASC']] });
  },

  findById: async (id: string): Promise<BoardColumn | null> => {
    return await BoardColumn.findByPk(id);
  },

  update: async (id: string, data: Partial<Pick<BoardColumnCreationAttributes, 'name'>>): Promise<BoardColumn | null> => {
    const column = await BoardColumn.findByPk(id);
    if (!column) return null;
    return await column.update(data);
  },

  delete: async (id: string): Promise<boolean> => {
    const deleted = await BoardColumn.destroy({ where: { id } });
    return deleted > 0;
  },
};
