import type { Optional } from 'sequelize';
import type { CLASS_MEMBERSHIP_OUTCOMES } from '../constants/index.js';

export type ClassMembershipOutcome =
  (typeof CLASS_MEMBERSHIP_OUTCOMES)[keyof typeof CLASS_MEMBERSHIP_OUTCOMES];

export interface ClassMembershipAttributes {
  id: string;
  studentId: string;
  sectionId: string;
  academicYearId: string;
  outcome: ClassMembershipOutcome;
  promotedToId: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export type ClassMembershipCreationAttributes = Optional<
  ClassMembershipAttributes,
  'id' | 'outcome' | 'promotedToId' | 'createdAt' | 'updatedAt'
>;
