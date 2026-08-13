import type { Optional } from 'sequelize';
import type { INSTITUTION_TYPES, COURSE_TYPES } from '../constants/index.js';

export type InstitutionType =
  (typeof INSTITUTION_TYPES)[keyof typeof INSTITUTION_TYPES];

export type CourseType = (typeof COURSE_TYPES)[keyof typeof COURSE_TYPES];

export interface ProgramAttributes {
  id: string;
  name: string;
  description: string | null;
  affiliation: string | null;
  abbreviation: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export type ProgramCreationAttributes = Optional<
  ProgramAttributes,
  'id' | 'description' | 'affiliation' | 'abbreviation' | 'createdAt' | 'updatedAt'
>;

export interface BatchAttributes {
  id: string;
  programId: string;
  name: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export type BatchCreationAttributes = Optional<
  BatchAttributes,
  'id' | 'createdAt' | 'updatedAt'
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

export type AcademicYearTerm = 'odd' | 'even' | 'annual';

export interface AcademicYearAttributes {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
  term: AcademicYearTerm;
  createdAt?: Date;
  updatedAt?: Date;
}

export type AcademicYearCreationAttributes = Optional<
  AcademicYearAttributes,
  'id' | 'isCurrent' | 'term' | 'createdAt' | 'updatedAt'
>;

export interface SectionAttributes {
  id: string;
  classId: string;
  batchId: string;
  startDate: string;
  classTeacherId: string | null;
  name: string;
  capacity: number | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export type SectionCreationAttributes = Optional<
  SectionAttributes,
  'id' | 'classTeacherId' | 'capacity' | 'createdAt' | 'updatedAt'
>;

export interface CourseAttributes {
  id: string;
  classId: string;
  title: string;
  code: string;
  description: string | null;
  courseType: CourseType;
  capacity: number | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export type CourseCreationAttributes = Optional<
  CourseAttributes,
  'id' | 'description' | 'courseType' | 'capacity' | 'createdAt' | 'updatedAt'
>;

export interface CourseTeacherAttributes {
  id: string;
  teacherId: string;
  courseId: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export type CourseTeacherCreationAttributes = Optional<
  CourseTeacherAttributes,
  'id' | 'createdAt' | 'updatedAt'
>;
