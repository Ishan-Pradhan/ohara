import type { Transaction } from 'sequelize';
import { Project } from '../models/projects.model.js';
import type { ProjectCreationAttributes } from '../types/kanban.types.js';

export const projectRepository = {
  create: async (data: ProjectCreationAttributes, transaction?: Transaction): Promise<Project> => {
    return await Project.create(data, { transaction });
  },

  findAllByCourse: async (courseId: string): Promise<Project[]> => {
    return await Project.findAll({ where: { courseId }, order: [['createdAt', 'ASC']] });
  },

  findById: async (id: string): Promise<Project | null> => {
    return await Project.findByPk(id, {
      include: [
        {
          association: 'columns',
          include: [{ association: 'tasks', include: ['assignee'] }],
        },
      ],
    });
  },

  delete: async (id: string): Promise<boolean> => {
    const deleted = await Project.destroy({ where: { id } });
    return deleted > 0;
  },
};
