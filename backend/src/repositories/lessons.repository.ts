import type { Transaction } from 'sequelize';
import { QueryTypes } from 'sequelize';
import { Lesson } from '../models/lessons.model.js';
import { sequelize } from '../config/db.js';
import type {
  LessonCreationAttributes,
  LessonAttributes,
} from '../types/courseContent.types.js';

export const lessonRepository = {
  create: async (data: LessonCreationAttributes, transaction?: Transaction): Promise<Lesson> => {
    return await Lesson.create(data, { transaction });
  },

  /** Whether a course has any generated lesson content at all — the
   * tutor agent's grounding check for the get_lesson path, alongside
   * documentChunkRepository.existsForDocument for the search_course_material
   * path (see tutorAgent.ts). Course structure generation writes lessons
   * directly and never touches DocumentChunks, so a course can be fully
   * "has material" via lessons alone with zero document chunks — checking
   * only one of the two would wrongly refuse to answer. */
  existsForCourse: async (courseId: string): Promise<boolean> => {
    const row = await sequelize.query<{ exists: boolean }>(
      `SELECT EXISTS (
         SELECT 1 FROM "Lessons" l
         JOIN "Modules" m ON m.id = l."moduleId"
         WHERE m."courseId" = :courseId
       ) AS "exists"`,
      {
        replacements: { courseId },
        type: QueryTypes.SELECT,
        plain: true,
      },
    );
    return row?.exists ?? false;
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
