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
import { AcademicYear } from './academicYears.model.js';

/** A cohort label (e.g. "26/27") that stays fixed for a group of students
 * across every promotion in a program — see docs/SCHEMA.md. */
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

  @ForeignKey(() => AcademicYear)
  @AllowNull(false)
  @Column(DataType.UUID)
  declare startAcademicYearId: string;

  @BelongsTo(() => AcademicYear, { foreignKey: 'startAcademicYearId' })
  declare startAcademicYear?: AcademicYear;
}
