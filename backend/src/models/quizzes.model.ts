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

import { QUIZ_STATUS } from '../constants/index.js';
import type { QuizStatus } from '../types/quizzes.types.js';
import { Course } from './courses.model.js';
import { Question } from './questions.model.js';
import { Batch } from './batches.model.js';

@Table({ tableName: 'Quizzes', timestamps: true })
export class Quiz extends Model {
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

  /** Same batch scoping as Assignment.batchId — see there. */
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
  @Default(QUIZ_STATUS.DRAFT)
  @Column(DataType.ENUM(QUIZ_STATUS.DRAFT, QUIZ_STATUS.PUBLISHED))
  declare status: QuizStatus;

  @HasMany(() => Question)
  declare questions?: Question[];
}
