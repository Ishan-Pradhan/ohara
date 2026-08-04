import type { Optional } from 'sequelize';
import type { STUDENT_FLAG_STATUSES } from '../constants/index.js';

export type StudentFlagStatus = (typeof STUDENT_FLAG_STATUSES)[keyof typeof STUDENT_FLAG_STATUSES];

export interface StudentFlagAttributes {
  id: string;
  studentId: string;
  raisedBy: string;
  courseId: string | null;
  sectionId: string | null;
  reason: string;
  status: StudentFlagStatus;
  createdAt?: Date;
  updatedAt?: Date;
}

export type StudentFlagCreationAttributes = Optional<
  StudentFlagAttributes,
  'id' | 'courseId' | 'sectionId' | 'status' | 'createdAt' | 'updatedAt'
>;
