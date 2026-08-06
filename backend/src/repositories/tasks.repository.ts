import type { Transaction } from 'sequelize';
import { Task } from '../models/tasks.model.js';
import type { TaskCreationAttributes } from '../types/kanban.types.js';

export const taskRepository = {
  create: async (data: TaskCreationAttributes): Promise<Task> => {
    return await Task.create(data);
  },

  findByColumn: async (columnId: string, transaction?: Transaction): Promise<Task[]> => {
    return await Task.findAll({ where: { columnId }, order: [['orderIndex', 'ASC']], transaction });
  },

  findById: async (id: string): Promise<Task | null> => {
    return await Task.findByPk(id, { include: ['assignee'] });
  },

  findByAssignee: async (assigneeId: string): Promise<Task[]> => {
    return await Task.findAll({ where: { assigneeId }, include: ['column'], order: [['createdAt', 'DESC']] });
  },

  update: async (
    id: string,
    data: Partial<Pick<TaskCreationAttributes, 'title' | 'description' | 'assigneeId'>>,
  ): Promise<Task | null> => {
    const task = await Task.findByPk(id);
    if (!task) return null;
    return await task.update(data);
  },

  /** Sets a task's column/position directly — used by the move orchestration
   * in kanban.controller.ts, which reindexes every affected task in one
   * transaction rather than shifting individual rows incrementally. */
  setPosition: async (
    id: string,
    columnId: string,
    orderIndex: number,
    transaction: Transaction,
  ): Promise<void> => {
    await Task.update({ columnId, orderIndex }, { where: { id }, transaction });
  },

  delete: async (id: string): Promise<boolean> => {
    const deleted = await Task.destroy({ where: { id } });
    return deleted > 0;
  },
};
