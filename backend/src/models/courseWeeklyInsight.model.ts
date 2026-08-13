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

import { Course } from './courses.model.js';
import type { NarrativeInsights } from '../types/aiInsights.types.js';

/** One cached row per course: a teacher's weekly class-intelligence AI
 * insights, regenerated only when explicitly requested. `weekStart` records
 * which week the cached content was generated for. */
@Table({ tableName: 'course_weekly_insights', timestamps: true })
export class CourseWeeklyInsight extends Model {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  declare id: string;

  @ForeignKey(() => Course)
  @AllowNull(false)
  @Unique
  @Column(DataType.UUID)
  declare courseId: string;

  @BelongsTo(() => Course)
  declare course?: Course;

  @AllowNull(false)
  @Column(DataType.DATEONLY)
  declare weekStart: string;

  @AllowNull(false)
  @Column(DataType.JSONB)
  declare content: NarrativeInsights;

  @AllowNull(false)
  @Default(DataType.NOW)
  @Column(DataType.DATE)
  declare generatedAt: Date;
}
