import type { Optional } from 'sequelize';

export interface StudentProfileAttributes {
  id: string;
  userId: string;
  parentName: string | null;
  parentPhone: string | null;
  address: string | null;
  dateOfBirth: string | null;
  previousSchool: string | null;
  studentPhone: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export type StudentProfileCreationAttributes = Optional<
  StudentProfileAttributes,
  | 'id'
  | 'parentName'
  | 'parentPhone'
  | 'address'
  | 'dateOfBirth'
  | 'previousSchool'
  | 'studentPhone'
  | 'createdAt'
  | 'updatedAt'
>;
