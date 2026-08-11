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
import { Course } from './courses.model.js';

export type InterventionType = 'ai_generated' | 'manual' | 'meeting' | 'tutoring' | 'other';
export type InterventionStatus = 'active' | 'resolved' | 'dismissed';

export interface InterventionAction {
  description: string;
  timeline: string;
  resources?: string;
}

@Table({ tableName: 'interventions', timestamps: true })
export class Intervention extends Model {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  declare id: string;

  @ForeignKey(() => User)
  @AllowNull(false)
  @Column(DataType.UUID)
  declare studentId: string;

  @BelongsTo(() => User, 'studentId')
  declare student?: User;

  @ForeignKey(() => Course)
  @AllowNull(false)
  @Column(DataType.UUID)
  declare courseId: string;

  @BelongsTo(() => Course)
  declare course?: Course;

  @ForeignKey(() => User)
  @AllowNull(false)
  @Column(DataType.UUID)
  declare teacherId: string;

  @BelongsTo(() => User, 'teacherId')
  declare teacher?: User;

  @AllowNull(false)
  @Column(DataType.ENUM('ai_generated', 'manual', 'meeting', 'tutoring', 'other'))
  declare type: InterventionType;

  @AllowNull(false)
  @Column(DataType.STRING)
  declare title: string;

  @AllowNull(false)
  @Column(DataType.TEXT)
  declare notes: string;

  @AllowNull(false)
  @Default([])
  @Column(DataType.JSONB)
  declare actions: InterventionAction[];

  @AllowNull(false)
  @Default('active')
  @Column(DataType.ENUM('active', 'resolved', 'dismissed'))
  declare status: InterventionStatus;

  @AllowNull(true)
  @Column(DataType.DATE)
  declare resolvedAt: Date | null;

  @AllowNull(true)
  @Column(DataType.JSONB)
  declare metricsAtCreation: Record<string, unknown> | null;

  @AllowNull(true)
  @Column(DataType.JSONB)
  declare metricsAtResolution: Record<string, unknown> | null;
}
