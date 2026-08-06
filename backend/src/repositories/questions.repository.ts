import type { Transaction } from 'sequelize';
import { Question } from '../models/questions.model.js';
import type {
  QuestionAttributes,
  QuestionCreationAttributes,
} from '../types/quizzes.types.js';

export const questionRepository = {
  create: async (
    data: QuestionCreationAttributes,
    transaction?: Transaction,
  ): Promise<Question> => {
    return await Question.create(data, { transaction });
  },

  findAllByQuiz: async (quizId: string): Promise<Question[]> => {
    return await Question.findAll({ where: { quizId }, order: [['orderIndex', 'ASC']] });
  },

  findById: async (id: string): Promise<Question | null> => {
    return await Question.findByPk(id);
  },

  maxOrderIndex: async (quizId: string): Promise<number> => {
    const max = await Question.max('orderIndex', { where: { quizId } });
    return typeof max === 'number' ? max : -1;
  },

  update: async (
    id: string,
    data: Partial<
      Pick<QuestionAttributes, 'prompt' | 'options' | 'answer' | 'points' | 'orderIndex'>
    >,
  ): Promise<Question | null> => {
    const question = await Question.findByPk(id);
    if (!question) return null;
    return await question.update(data);
  },

  delete: async (id: string): Promise<boolean> => {
    const deleted = await Question.destroy({ where: { id } });
    return deleted > 0;
  },
};
