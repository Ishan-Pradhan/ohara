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

import { Class } from './classes.model.js';
import { Batch } from './batches.model.js';
import { User } from './users.model.js';

/** One specific offering of a class (semester) — identified by which batch
 * is taking it, not which academic year it happens to fall in. A batch has
 * at most one section per class, ever (Nepali affiliated-university
 * programs promote unconditionally; there's no repeating a semester —
 * see docs/SCHEMA.md), so (classId, batchId, name) is enough to be unique
 * without any notion of "current" academic year. */
@Table({ tableName: 'Sections', timestamps: true })
export class Section extends Model {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  declare id: string;

  @ForeignKey(() => Class)
  @AllowNull(false)
  @Column(DataType.UUID)
  declare classId: string;

  @BelongsTo(() => Class)
  declare class?: Class;

  @ForeignKey(() => Batch)
  @AllowNull(false)
  @Column(DataType.UUID)
  declare batchId: string;

  @BelongsTo(() => Batch)
  declare batch?: Batch;

  /** When this offering actually started — display/reporting only (e.g. a
   * transcript row), never used to resolve "is this current." Set once,
   * at creation (promotion, or admission for a batch's first semester). */
  @AllowNull(false)
  @Column(DataType.DATEONLY)
  declare startDate: string;

  @ForeignKey(() => User)
  @Default(null)
  @Column(DataType.UUID)
  declare classTeacherId: string | null;

  @BelongsTo(() => User)
  declare classTeacher?: User;

  @AllowNull(false)
  @Column(DataType.STRING)
  declare name: string;

  /** Null means uncapped — not every institution needs a hard limit per section. */
  @Default(null)
  @Column(DataType.INTEGER)
  declare capacity: number | null;
}
