import type { Optional } from 'sequelize';
import type { QUIZ_STATUS, QUESTION_TYPES } from '../constants/index.js';

export type QuizStatus = (typeof QUIZ_STATUS)[keyof typeof QUIZ_STATUS];
export type QuestionType = (typeof QUESTION_TYPES)[keyof typeof QUESTION_TYPES];

export interface McqAnswer {
  correctIndex: number;
}

export interface QuizAttributes {
  id: string;
  courseId: string;
  title: string;
  status: QuizStatus;
  createdAt?: Date;
  updatedAt?: Date;
}

export type QuizCreationAttributes = Optional<
  QuizAttributes,
  'id' | 'status' | 'createdAt' | 'updatedAt'
>;

export type QuestionDifficulty = 'easy' | 'medium' | 'hard';
export type CognitiveLevel = 'remember' | 'understand' | 'apply' | 'analyze' | 'evaluate' | 'create';

export interface QuestionAttributes {
  id: string;
  quizId: string;
  type: QuestionType;
  prompt: string;
  options: string[] | null;
  answer: McqAnswer | null;
  points: number;
  orderIndex: number;
  difficulty: QuestionDifficulty | null;
  cognitiveLevel: CognitiveLevel | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export type QuestionCreationAttributes = Optional<
  QuestionAttributes,
  'id' | 'options' | 'answer' | 'points' | 'createdAt' | 'updatedAt' | 'difficulty' | 'cognitiveLevel'
>;
