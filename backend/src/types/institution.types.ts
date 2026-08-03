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
