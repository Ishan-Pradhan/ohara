import { Quiz } from '../models/quizzes.model.js';
import { Question } from '../models/questions.model.js';
import type { QuizCreationAttributes, QuizStatus } from '../types/quizzes.types.js';

export const quizRepository = {
  create: async (data: QuizCreationAttributes): Promise<Quiz> => {
    return await Quiz.create(data);
  },

  findAllByCourse: async (courseId: string, status?: QuizStatus): Promise<Quiz[]> => {
    return await Quiz.findAll({
      where: status ? { courseId, status } : { courseId },
      order: [['createdAt', 'DESC']],
    });
  },

  findById: async (id: string, includeQuestions = false): Promise<Quiz | null> => {
    return await Quiz.findByPk(id, {
      include: includeQuestions
        ? [{ model: Question, as: 'questions', separate: true, order: [['orderIndex', 'ASC']] }]
        : [],
    });
  },

  update: async (id: string, data: Partial<{ title: string }>): Promise<Quiz | null> => {
    const quiz = await Quiz.findByPk(id);
    if (!quiz) return null;
    return await quiz.update(data);
  },

  setStatus: async (id: string, status: QuizStatus): Promise<Quiz | null> => {
    const quiz = await Quiz.findByPk(id);
    if (!quiz) return null;
    return await quiz.update({ status });
  },

  /** Questions/attempts cascade at the DB level — the quiz is the aggregate root. */
  delete: async (id: string): Promise<boolean> => {
    const deleted = await Quiz.destroy({ where: { id } });
    return deleted > 0;
  },
};
