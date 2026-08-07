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
  HasMany,
} from 'sequelize-typescript';

import { AcademicYear } from './academicYears.model.js';
import { User } from './users.model.js';
import { ExamMark } from './examMarks.model.js';

/** An admin-defined internal exam event — "First Terminal", "Preboard",
 * "Re-exam" — scoped to an academic year. Distinct from assignments/quizzes:
 * this is the formal exam schedule whose marks make up the report card. */
@Table({ tableName: 'ExamTerms', timestamps: true })
export class ExamTerm extends Model {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  declare id: string;

  @AllowNull(false)
  @Column(DataType.STRING)
  declare name: string;

  @ForeignKey(() => AcademicYear)
  @AllowNull(false)
  @Column(DataType.UUID)
  declare academicYearId: string;

  @BelongsTo(() => AcademicYear)
  declare academicYear?: AcademicYear;

  @ForeignKey(() => User)
  @AllowNull(false)
  @Column(DataType.UUID)
  declare createdBy: string;

  @BelongsTo(() => User, 'createdBy')
  declare creator?: User;

  @HasMany(() => ExamMark)
  declare marks?: ExamMark[];
}
