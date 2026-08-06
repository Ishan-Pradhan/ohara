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

import { GRADE_STATUS } from '../constants/index.js';
import type { GradeStatus } from '../types/grades.types.js';
import { QuizAttempt } from './quizAttempts.model.js';
import { Question } from './questions.model.js';
import { User } from './users.model.js';

@Table({ tableName: 'QuizAnswerGrades', timestamps: true })
export class QuizAnswerGrade extends Model {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  declare id: string;

  @ForeignKey(() => QuizAttempt)
  @AllowNull(false)
  @Column(DataType.UUID)
  declare attemptId: string;

  @BelongsTo(() => QuizAttempt)
  declare attempt?: QuizAttempt;

  @ForeignKey(() => Question)
  @AllowNull(false)
  @Column(DataType.UUID)
  declare questionId: string;

  @BelongsTo(() => Question)
  declare question?: Question;

  @AllowNull(false)
  @Column(DataType.DECIMAL)
  declare awardedPoints: number;

  @AllowNull(false)
  @Column(DataType.DECIMAL)
  declare maxPoints: number;

  @Column(DataType.TEXT)
  declare feedback: string | null;

  @AllowNull(false)
  @Default(GRADE_STATUS.DRAFT)
  @Column(DataType.ENUM(GRADE_STATUS.DRAFT, GRADE_STATUS.APPROVED))
  declare status: GradeStatus;

  @ForeignKey(() => User)
  @Column(DataType.UUID)
  declare approvedBy: string | null;

  @BelongsTo(() => User)
  declare approver?: User;
}
