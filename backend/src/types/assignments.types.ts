import type { Optional } from 'sequelize';

export interface RubricCriterion {
  criterion: string;
  maxPoints: number;
  description?: string;
}

export interface AssignmentAttributes {
  id: string;
  courseId: string;
  title: string;
  prompt: string;
  rubric: RubricCriterion[];
  dueAt: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

export type AssignmentCreationAttributes = Optional<
  AssignmentAttributes,
  'id' | 'createdAt' | 'updatedAt'
>;
