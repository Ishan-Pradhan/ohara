import type { Optional } from 'sequelize';

export interface QuizResponse {
  questionId: string;
  answer: number | string;
}

export interface QuizAttemptAttributes {
  id: string;
  quizId: string;
  studentId: string;
  responses: QuizResponse[];
  score: number;
  maxScore: number;
  submittedAt: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

export type QuizAttemptCreationAttributes = Optional<
  QuizAttemptAttributes,
  'id' | 'createdAt' | 'updatedAt'
>;
