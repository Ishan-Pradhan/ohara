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
