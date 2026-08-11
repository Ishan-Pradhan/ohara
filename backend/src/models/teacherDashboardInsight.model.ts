import 'reflect-metadata';
import {
  Table,
  Column,
  Model,
  DataType,
  Default,
  AllowNull,
  Unique,
  PrimaryKey,
  ForeignKey,
  BelongsTo,
} from 'sequelize-typescript';

import { User } from './users.model.js';
import type { DashboardInsights } from '../types/teacherDashboard.types.js';

/** One cached row per teacher — see the create migration for why this
 * exists (was previously an LLM call on every dashboard GET). */
@Table({ tableName: 'teacher_dashboard_insights', timestamps: true })
export class TeacherDashboardInsight extends Model {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  declare id: string;

  @ForeignKey(() => User)
  @AllowNull(false)
  @Unique
  @Column(DataType.UUID)
  declare teacherId: string;

  @BelongsTo(() => User)
  declare teacher?: User;

  @AllowNull(false)
  @Column(DataType.JSONB)
  declare content: DashboardInsights;

  @AllowNull(false)
  @Default(DataType.NOW)
  @Column(DataType.DATE)
  declare generatedAt: Date;
}
