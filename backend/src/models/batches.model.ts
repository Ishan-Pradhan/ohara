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

import { Program } from './programs.model.js';

/** A cohort label (e.g. "2026") that stays fixed for a group of students,
 * across every promotion, for their entire academic life in the program —
 * see docs/SCHEMA.md. `name` alone is the batch's identity: admission
 * happens once a year, so the batch itself already says when it started;
 * there's no separate year FK to keep in sync with it. */
@Table({ tableName: 'Batches', timestamps: true })
export class Batch extends Model {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  declare id: string;

  @ForeignKey(() => Program)
  @AllowNull(false)
  @Column(DataType.UUID)
  declare programId: string;

  @BelongsTo(() => Program)
  declare program?: Program;

  @AllowNull(false)
  @Column(DataType.STRING)
  declare name: string;
}
