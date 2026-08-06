import { Grade } from '../models/grades.model.js';
import type { GradeCreationAttributes, CriterionFeedback } from '../types/grades.types.js';

export const gradeRepository = {
  create: async (data: GradeCreationAttributes): Promise<Grade> => {
    return await Grade.create(data);
  },

  findBySubmissionId: async (submissionId: string): Promise<Grade | null> => {
    return await Grade.findOne({ where: { submissionId } });
  },

  /** Teacher edit/approve — the only path that can set status: 'approved' (golden rule 6). */
  update: async (
    id: string,
    data: Partial<{
      score: number;
      criterionFeedback: CriterionFeedback[];
      overallFeedback: string | null;
      status: 'draft' | 'approved';
      approvedBy: string | null;
    }>,
  ): Promise<Grade | null> => {
    const grade = await Grade.findByPk(id);
    if (!grade) return null;
    return await grade.update(data);
  },

  /** Clears a draft grade on resubmission — approved grades never reach here,
   * the controller blocks resubmission before this is called. */
  deleteBySubmissionId: async (submissionId: string): Promise<void> => {
    await Grade.destroy({ where: { submissionId } });
  },
};
