import type { Optional } from 'sequelize';

export interface ExamTermAttributes {
  id: string;
  name: string;
  academicYearId: string;
  createdBy: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export type ExamTermCreationAttributes = Optional<
  ExamTermAttributes,
  'id' | 'createdAt' | 'updatedAt'
>;

export interface ExamMarkAttributes {
  id: string;
  examTermId: string;
  courseId: string;
  studentId: string;
  marksObtained: number;
  maxMarks: number;
  enteredBy: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export type ExamMarkCreationAttributes = Optional<
  ExamMarkAttributes,
  'id' | 'createdAt' | 'updatedAt'
>;
