import type { Optional } from 'sequelize';
import type { GradeStatus } from './grades.types.js';

export interface QuizAnswerGradeAttributes {
  id: string;
  attemptId: string;
  questionId: string;
  awardedPoints: number;
  maxPoints: number;
  feedback: string | null;
  status: GradeStatus;
  approvedBy: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export type QuizAnswerGradeCreationAttributes = Optional<
  QuizAnswerGradeAttributes,
  'id' | 'feedback' | 'status' | 'approvedBy' | 'createdAt' | 'updatedAt'
>;
