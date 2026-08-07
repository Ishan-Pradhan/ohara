import { ExamTerm } from '../models/examTerms.model.js';
import type { ExamTermCreationAttributes } from '../types/examMarks.types.js';

export const examTermRepository = {
  create: async (data: ExamTermCreationAttributes): Promise<ExamTerm> => {
    return await ExamTerm.create(data);
  },

  findAll: async (options?: { academicYearId?: string }): Promise<ExamTerm[]> => {
    const where: Record<string, string> = {};
    if (options?.academicYearId) where.academicYearId = options.academicYearId;
    return await ExamTerm.findAll({ where, order: [['createdAt', 'ASC']] });
  },

  findById: async (id: string): Promise<ExamTerm | null> => {
    return await ExamTerm.findByPk(id);
  },

  /** `ExamMarks.examTermId` cascades — deleting a term deletes every mark
   * entered against it, same as deleting a Kanban project cascades its
   * columns/tasks. */
  delete: async (id: string): Promise<boolean> => {
    const deleted = await ExamTerm.destroy({ where: { id } });
    return deleted > 0;
  },
};
