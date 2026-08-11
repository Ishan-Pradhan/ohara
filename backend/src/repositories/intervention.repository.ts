import type { Optional } from 'sequelize';
import { Intervention } from '../models/intervention.model.js';
import type { InterventionType, InterventionAction } from '../models/intervention.model.js';
import { User } from '../models/users.model.js';

interface InterventionAttributes {
  id: string;
  studentId: string;
  courseId: string;
  teacherId: string;
  type: InterventionType;
  title: string;
  notes: string;
  actions: InterventionAction[];
  status: 'active' | 'resolved' | 'dismissed';
  resolvedAt: Date | null;
  metricsAtCreation: Record<string, unknown> | null;
  metricsAtResolution: Record<string, unknown> | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export type InterventionCreationAttributes = Optional<
  InterventionAttributes,
  'id' | 'createdAt' | 'updatedAt' | 'actions' | 'status' | 'resolvedAt' | 'metricsAtCreation' | 'metricsAtResolution'
>;

export const interventionRepository = {
  create: async (data: InterventionCreationAttributes): Promise<Intervention> => {
    return await Intervention.create(data);
  },

  findById: async (id: string): Promise<Intervention | null> => {
    return await Intervention.findByPk(id, {
      include: [
        { model: User, as: 'student', attributes: ['id', 'name', 'email'] },
        { model: User, as: 'teacher', attributes: ['id', 'name', 'email'] },
      ],
    });
  },

  findByCourse: async (courseId: string): Promise<Intervention[]> => {
    return await Intervention.findAll({
      where: { courseId },
      include: [
        { model: User, as: 'student', attributes: ['id', 'name', 'email'] },
        { model: User, as: 'teacher', attributes: ['id', 'name', 'email'] },
      ],
      order: [['createdAt', 'DESC']],
    });
  },

  findByCourseAndStudent: async (courseId: string, studentId: string): Promise<Intervention[]> => {
    return await Intervention.findAll({
      where: { courseId, studentId },
      include: [
        { model: User, as: 'student', attributes: ['id', 'name', 'email'] },
        { model: User, as: 'teacher', attributes: ['id', 'name', 'email'] },
      ],
      order: [['createdAt', 'DESC']],
    });
  },

  update: async (
    id: string,
    data: Partial<Pick<Intervention, 'title' | 'notes' | 'status' | 'resolvedAt' | 'actions' | 'metricsAtCreation' | 'metricsAtResolution'>>,
  ): Promise<Intervention | null> => {
    const intervention = await Intervention.findByPk(id);
    if (!intervention) return null;
    return await intervention.update(data);
  },

  delete: async (id: string): Promise<boolean> => {
    const deleted = await Intervention.destroy({ where: { id } });
    return deleted > 0;
  },
};
