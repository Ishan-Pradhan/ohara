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
import { Batch } from './batches.model.js';

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

  /** The batch this enrollment belongs to — a Course is permanently attached
   * to its Class and reused by every future batch that reaches it, so
   * without this a new batch would inherit the previous batch's enrollment
   * rows for the same course. Always the student's own (permanent) batch. */
  @ForeignKey(() => Batch)
  @AllowNull(false)
  @Column(DataType.UUID)
  declare batchId: string;

  @BelongsTo(() => Batch)
  declare batch?: Batch;

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
