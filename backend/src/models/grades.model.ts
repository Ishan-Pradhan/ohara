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
import type { GradeStatus, CriterionFeedback } from '../types/grades.types.js';
import { Submission } from './submissions.model.js';
import { User } from './users.model.js';

@Table({ tableName: 'Grades', timestamps: true })
export class Grade extends Model {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  declare id: string;

  @ForeignKey(() => Submission)
  @AllowNull(false)
  @Column(DataType.UUID)
  declare submissionId: string;

  @BelongsTo(() => Submission)
  declare submission?: Submission;

  @AllowNull(false)
  @Column(DataType.DECIMAL)
  declare score: number;

  @AllowNull(false)
  @Column(DataType.JSONB)
  declare criterionFeedback: CriterionFeedback[];

  @Column(DataType.TEXT)
  declare overallFeedback: string | null;

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
