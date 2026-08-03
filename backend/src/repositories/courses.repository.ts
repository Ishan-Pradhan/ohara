import { Course } from '../models/courses.model.js';
import type { CourseCreationAttributes } from '../types/institution.types.js';

export const courseRepository = {
  create: async (data: CourseCreationAttributes): Promise<Course> => {
    return await Course.create(data);
  },

  findAll: async (options?: { classId?: string }): Promise<Course[]> => {
    const where = options?.classId ? { classId: options.classId } : {};
    return await Course.findAll({ where, order: [['title', 'ASC']] });
  },

  findById: async (id: string): Promise<Course | null> => {
    return await Course.findByPk(id);
  },
};
