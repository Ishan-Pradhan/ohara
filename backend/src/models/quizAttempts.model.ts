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

import type { QuizResponse } from '../types/quizAttempts.types.js';
import { Quiz } from './quizzes.model.js';
import { User } from './users.model.js';

@Table({ tableName: 'QuizAttempts', timestamps: true })
export class QuizAttempt extends Model {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  declare id: string;

  @ForeignKey(() => Quiz)
  @AllowNull(false)
  @Column(DataType.UUID)
  declare quizId: string;

  @BelongsTo(() => Quiz)
  declare quiz?: Quiz;

  @ForeignKey(() => User)
  @AllowNull(false)
  @Column(DataType.UUID)
  declare studentId: string;

  @BelongsTo(() => User)
  declare student?: User;

  @AllowNull(false)
  @Column(DataType.JSONB)
  declare responses: QuizResponse[];

  @AllowNull(false)
  @Column(DataType.DECIMAL)
  declare score: number;

  @AllowNull(false)
  @Column(DataType.DECIMAL)
  declare maxScore: number;

  @AllowNull(false)
  @Column(DataType.DATE)
  declare submittedAt: Date;
}
