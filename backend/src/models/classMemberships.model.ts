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

import { CLASS_MEMBERSHIP_OUTCOMES } from '../constants/index.js';
import type { ClassMembershipOutcome } from '../types/placement.types.js';
import { User } from './users.model.js';
import { Section } from './sections.model.js';
import { Class } from './classes.model.js';
import { Batch } from './batches.model.js';

@Table({ tableName: 'ClassMemberships', timestamps: true })
export class ClassMembership extends Model {
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

  @ForeignKey(() => Batch)
  @AllowNull(false)
  @Column(DataType.UUID)
  declare batchId: string;

  @BelongsTo(() => Batch)
  declare batch?: Batch;

  @ForeignKey(() => Section)
  @AllowNull(false)
  @Column(DataType.UUID)
  declare sectionId: string;

  @BelongsTo(() => Section)
  declare section?: Section;

  /** Denormalized from `section.classId` at write time — lets "which
   * semester" queries (gradebook, at-risk, transcript) join straight off
   * this table instead of through Sections. */
  @ForeignKey(() => Class)
  @AllowNull(false)
  @Column(DataType.UUID)
  declare classId: string;

  @BelongsTo(() => Class)
  declare class?: Class;

  @AllowNull(false)
  @Default(CLASS_MEMBERSHIP_OUTCOMES.ENROLLED)
  @Column(
    DataType.ENUM(
      CLASS_MEMBERSHIP_OUTCOMES.ENROLLED,
      CLASS_MEMBERSHIP_OUTCOMES.PROMOTED,
      CLASS_MEMBERSHIP_OUTCOMES.GRADUATED,
      CLASS_MEMBERSHIP_OUTCOMES.TRANSFERRED,
    ),
  )
  declare outcome: ClassMembershipOutcome;

  @ForeignKey(() => ClassMembership)
  @Default(null)
  @Column(DataType.UUID)
  declare promotedToId: string | null;

  @BelongsTo(() => ClassMembership, { foreignKey: 'promotedToId' })
  declare promotedTo?: ClassMembership;
}
