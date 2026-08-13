import { CourseTeacher } from '../models/courseTeachers.model.js';
import type { CourseTeacherCreationAttributes } from '../types/institution.types.js';

export const courseTeacherRepository = {
  assign: async (
    data: CourseTeacherCreationAttributes,
  ): Promise<CourseTeacher> => {
    return await CourseTeacher.create(data);
  },

  findByCourseId: async (courseId: string): Promise<CourseTeacher[]> => {
    return await CourseTeacher.findAll({ where: { courseId } });
  },

  /** Powers the teacher's "My Courses" list — each row's `course` is included. */
  findByTeacherId: async (teacherId: string): Promise<CourseTeacher[]> => {
    return await CourseTeacher.findAll({
      where: { teacherId },
      include: ['course'],
    });
  },

  /** Powers requireCourseTeacher — the one method Phase 3+ will call. */
  exists: async (teacherId: string, courseId: string): Promise<boolean> => {
    const found = await CourseTeacher.findOne({
      where: { teacherId, courseId },
    });
    return found !== null;
  },

  /** Just an access-grant mapping, not an academic record — safe to hard
   * delete (unlike removing a student, see docs/SCHEMA.md). Course-scoped
   * data the teacher created (grades, quizzes, interventions, ...) is
   * unaffected; this only revokes access. */
  unassign: async (courseId: string, teacherId: string): Promise<boolean> => {
    const deleted = await CourseTeacher.destroy({ where: { courseId, teacherId } });
    return deleted > 0;
  },
};
