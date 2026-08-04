import type { Transaction } from 'sequelize';
import { Lesson } from '../models/lessons.model.js';
import type {
  LessonCreationAttributes,
  LessonAttributes,
} from '../types/courseContent.types.js';

export const lessonRepository = {
  create: async (data: LessonCreationAttributes, transaction?: Transaction): Promise<Lesson> => {
    return await Lesson.create(data, { transaction });
  },

  findAllByModule: async (moduleId: string): Promise<Lesson[]> => {
    return await Lesson.findAll({ where: { moduleId }, order: [['orderIndex', 'ASC']] });
  },

  findById: async (id: string): Promise<Lesson | null> => {
    return await Lesson.findByPk(id);
  },

  update: async (
    id: string,
    data: Partial<Pick<LessonAttributes, 'title' | 'content' | 'keyTopics' | 'orderIndex'>>,
  ): Promise<Lesson | null> => {
    const lesson = await Lesson.findByPk(id);
    if (!lesson) return null;
    return await lesson.update(data);
  },

  delete: async (id: string): Promise<boolean> => {
    const deleted = await Lesson.destroy({ where: { id } });
    return deleted > 0;
  },
};
