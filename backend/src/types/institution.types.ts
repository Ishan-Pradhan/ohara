import type { Optional } from 'sequelize';
import type { INSTITUTION_TYPES } from '../constants/index.js';

export type InstitutionType =
  (typeof INSTITUTION_TYPES)[keyof typeof INSTITUTION_TYPES];

export interface ProgramAttributes {
  id: string;
  name: string;
  institutionType: InstitutionType;
  description: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export type ProgramCreationAttributes = Optional<
  ProgramAttributes,
  'id' | 'description' | 'createdAt' | 'updatedAt'
>;

export interface ClassAttributes {
  id: string;
  programId: string;
  name: string;
  orderIndex: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export type ClassCreationAttributes = Optional<
  ClassAttributes,
  'id' | 'createdAt' | 'updatedAt'
>;

export interface AcademicYearAttributes {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export type AcademicYearCreationAttributes = Optional<
  AcademicYearAttributes,
  'id' | 'isCurrent' | 'createdAt' | 'updatedAt'
>;

export interface SectionAttributes {
  id: string;
  classId: string;
  academicYearId: string;
  classTeacherId: string | null;
  name: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export type SectionCreationAttributes = Optional<
  SectionAttributes,
  'id' | 'classTeacherId' | 'createdAt' | 'updatedAt'
>;
