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

  update: async (
    id: string,
    data: Partial<
      Pick<CourseCreationAttributes, 'title' | 'code' | 'description' | 'courseType' | 'capacity'>
    >,
  ): Promise<Course | null> => {
    const course = await Course.findByPk(id);
    if (!course) return null;
    return await course.update(data);
  },

  /** `course_teachers.courseId` and `enrollments.courseId` are both ON DELETE
   * CASCADE — deleting a course sweeps away its teacher assignments and
   * enrollments too, per SCHEMA.md (a course is the aggregate root for its
   * content). No dependent-record guard applies here. */
  delete: async (id: string): Promise<boolean> => {
    const deleted = await Course.destroy({ where: { id } });
    return deleted > 0;
  },

  setPublished: async (id: string, isPublished: boolean): Promise<Course | null> => {
    const course = await Course.findByPk(id);
    if (!course) return null;
    return await course.update({ isPublished });
  },

  setKnowledgeBaseDocument: async (
    id: string,
    documentId: string | null,
  ): Promise<Course | null> => {
    const course = await Course.findByPk(id);
    if (!course) return null;
    return await course.update({ knowledgeBaseDocumentId: documentId });
  },

  setSyllabusDocument: async (
    id: string,
    documentId: string | null,
  ): Promise<Course | null> => {
    const course = await Course.findByPk(id);
    if (!course) return null;
    return await course.update({ syllabusDocumentId: documentId });
  },
};
