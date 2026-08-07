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

import { User } from './users.model.js';
import type { StudyPlanContent } from '../types/studyPlan.types.js';

export type StudyPlanStatus = 'active' | 'superseded';

@Table({ tableName: 'study_plans', timestamps: true })
export class StudyPlan extends Model {
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

  @AllowNull(false)
  @Column(DataType.DATEONLY)
  declare weekStart: string;

  @AllowNull(false)
  @Column(DataType.JSONB)
  declare content: StudyPlanContent;

  @AllowNull(false)
  @Default('active')
  @Column(DataType.ENUM('active', 'superseded'))
  declare status: StudyPlanStatus;

  @AllowNull(false)
  @Default(DataType.NOW)
  @Column(DataType.DATE)
  declare generatedAt: Date;

  @AllowNull(false)
  @Default(false)
  @Column(DataType.BOOLEAN)
  declare isStale: boolean;

  @AllowNull(true)
  @Column(DataType.TEXT)
  declare staleReason: string | null;
}
