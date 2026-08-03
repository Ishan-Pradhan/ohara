import 'reflect-metadata';
import {
  Table,
  Column,
  Model,
  DataType,
  Default,
  AllowNull,
  PrimaryKey,
  ForeignKey,
  BelongsTo,
} from 'sequelize-typescript';

import { ENROLLMENT_STATUSES } from '../constants/index.js';
import type { EnrollmentStatus } from '../types/placement.types.js';
import { User } from './users.model.js';
import { Course } from './courses.model.js';
import { AcademicYear } from './academicYears.model.js';

@Table({ tableName: 'Enrollments', timestamps: true })
export class Enrollment extends Model {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  declare id: string;

  @ForeignKey(() => User)
  @AllowNull(false)
  @Column(DataType.UUID)
  declare studentId: string;

  @BelongsTo(() => User)
  declare student?: User;

  @ForeignKey(() => Course)
  @AllowNull(false)
  @Column(DataType.UUID)
  declare courseId: string;

  @BelongsTo(() => Course)
  declare course?: Course;

  @ForeignKey(() => AcademicYear)
  @AllowNull(false)
  @Column(DataType.UUID)
  declare academicYearId: string;

  @BelongsTo(() => AcademicYear)
  declare academicYear?: AcademicYear;

  @AllowNull(false)
  @Default(ENROLLMENT_STATUSES.ACTIVE)
  @Column(
    DataType.ENUM(
      ENROLLMENT_STATUSES.ACTIVE,
      ENROLLMENT_STATUSES.COMPLETED,
      ENROLLMENT_STATUSES.DROPPED,
    ),
  )
  declare status: EnrollmentStatus;
}
