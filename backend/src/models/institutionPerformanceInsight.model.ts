import 'reflect-metadata';
import { Table, Column, Model, DataType, Default, AllowNull, PrimaryKey } from 'sequelize-typescript';

import type { NarrativeInsights } from '../types/aiInsights.types.js';

/** Single-tenant, single row: institution-wide AI insights, regenerated only
 * when an admin explicitly asks (POST /admin/institution-performance/insights).
 * Was previously generated fresh via an LLM call on every GET — see the
 * create migration for the full rationale. The repository always reads/writes
 * the earliest-created row, same convention as InstitutionProfile. */
@Table({ tableName: 'institution_performance_insights', timestamps: true })
export class InstitutionPerformanceInsight extends Model {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  declare id: string;

  @AllowNull(false)
  @Column(DataType.JSONB)
  declare content: NarrativeInsights;

  @AllowNull(false)
  @Default(DataType.NOW)
  @Column(DataType.DATE)
  declare generatedAt: Date;
}
