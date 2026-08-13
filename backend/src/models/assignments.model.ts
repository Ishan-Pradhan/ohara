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
  HasMany,
} from 'sequelize-typescript';

import type { RubricCriterion } from '../types/assignments.types.js';
import { Course } from './courses.model.js';
import { Submission } from './submissions.model.js';
import { Batch } from './batches.model.js';

@Table({ tableName: 'Assignments', timestamps: true })
export class Assignment extends Model {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  declare id: string;

  @ForeignKey(() => Course)
  @AllowNull(false)
  @Column(DataType.UUID)
  declare courseId: string;

  @BelongsTo(() => Course)
  declare course?: Course;

  /** The specific batch this assignment was created for — a Course is
   * permanently attached to a Class and reused by every future batch that
   * reaches it, so without this an assignment (and its due date) would
   * resurface for every later batch too. */
  @ForeignKey(() => Batch)
  @AllowNull(false)
  @Column(DataType.UUID)
  declare batchId: string;

  @BelongsTo(() => Batch)
  declare batch?: Batch;

  @AllowNull(false)
  @Column(DataType.STRING)
  declare title: string;

  @AllowNull(false)
  @Column(DataType.TEXT)
  declare prompt: string;

  @AllowNull(false)
  @Column(DataType.JSONB)
  declare rubric: RubricCriterion[];

  @AllowNull(false)
  @Column(DataType.DATE)
  declare dueAt: Date;

  @HasMany(() => Submission)
  declare submissions?: Submission[];
}
