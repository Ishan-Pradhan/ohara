import 'reflect-metadata';
import { Table, Column, Model, DataType, Default, AllowNull, PrimaryKey } from 'sequelize-typescript';

import type { NarrativeInsights } from '../types/aiInsights.types.js';

/** Single-tenant, single row: institution-wide weekly AI insights, regenerated
 * only when an admin explicitly asks. `weekStart` records which week the
 * cached content was generated for, so a stale cache (viewed after Monday's
 * rollover) can be labeled instead of silently presented as current. */
@Table({ tableName: 'institution_weekly_insights', timestamps: true })
export class InstitutionWeeklyInsight extends Model {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  declare id: string;

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
