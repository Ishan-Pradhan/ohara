import { QuizAttempt } from '../models/quizAttempts.model.js';
import type { QuizAttemptCreationAttributes } from '../types/quizAttempts.types.js';

export const quizAttemptRepository = {
  create: async (data: QuizAttemptCreationAttributes): Promise<QuizAttempt> => {
    return await QuizAttempt.create(data);
  },

  findByQuizAndStudent: async (quizId: string, studentId: string): Promise<QuizAttempt | null> => {
    return await QuizAttempt.findOne({ where: { quizId, studentId } });
  },

  findAllByQuiz: async (quizId: string): Promise<QuizAttempt[]> => {
    return await QuizAttempt.findAll({
      where: { quizId },
      include: ['student'],
      order: [['submittedAt', 'ASC']],
    });
  },

  findById: async (id: string): Promise<QuizAttempt | null> => {
    return await QuizAttempt.findByPk(id, { include: ['student'] });
  },

  /** Recomputed and persisted whenever a short-answer grade is
   * created/approved/edited, so every read path (gradebook included) shares
   * one source of truth instead of each recomputing it independently. */
  update: async (id: string, data: Partial<{ score: number }>): Promise<QuizAttempt | null> => {
    const attempt = await QuizAttempt.findByPk(id);
    if (!attempt) return null;
    return await attempt.update(data);
  },
};
