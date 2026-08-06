import type { Optional } from 'sequelize';
import type { GRADE_STATUS } from '../constants/index.js';

export type GradeStatus = (typeof GRADE_STATUS)[keyof typeof GRADE_STATUS];

export interface CriterionFeedback {
  criterion: string;
  maxPoints: number;
  awardedPoints: number;
  feedback: string;
}

export interface GradeAttributes {
  id: string;
  submissionId: string;
  score: number;
  criterionFeedback: CriterionFeedback[];
  overallFeedback: string | null;
  status: GradeStatus;
  approvedBy: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export type GradeCreationAttributes = Optional<
  GradeAttributes,
  'id' | 'overallFeedback' | 'status' | 'approvedBy' | 'createdAt' | 'updatedAt'
>;
