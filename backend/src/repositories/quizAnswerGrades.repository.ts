import { QuizAnswerGrade } from '../models/quizAnswerGrades.model.js';
import type { QuizAnswerGradeCreationAttributes } from '../types/quizAnswerGrades.types.js';
import type { GradeStatus } from '../types/grades.types.js';

export const quizAnswerGradeRepository = {
  create: async (data: QuizAnswerGradeCreationAttributes): Promise<QuizAnswerGrade> => {
    return await QuizAnswerGrade.create(data);
  },

  findByAttempt: async (attemptId: string): Promise<QuizAnswerGrade[]> => {
    return await QuizAnswerGrade.findAll({ where: { attemptId } });
  },

  findByAttemptAndQuestion: async (
    attemptId: string,
    questionId: string,
  ): Promise<QuizAnswerGrade | null> => {
    return await QuizAnswerGrade.findOne({ where: { attemptId, questionId } });
  },

  update: async (
    id: string,
    data: Partial<{
      awardedPoints: number;
      maxPoints: number;
      feedback: string | null;
      status: GradeStatus;
      approvedBy: string | null;
    }>,
  ): Promise<QuizAnswerGrade | null> => {
    const grade = await QuizAnswerGrade.findByPk(id);
    if (!grade) return null;
    return await grade.update(data);
  },

  /** Clears a draft grade so a fresh AI regrade can replace it — mirrors
   * gradeRepository.deleteBySubmissionId for assignments. */
  deleteByAttemptAndQuestion: async (attemptId: string, questionId: string): Promise<void> => {
    await QuizAnswerGrade.destroy({ where: { attemptId, questionId } });
  },
};
