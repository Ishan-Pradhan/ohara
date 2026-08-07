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

import { ExamTerm } from './examTerms.model.js';
import { Course } from './courses.model.js';
import { User } from './users.model.js';

/** One student's marks in one course for one exam term. Unique per
 * (examTermId, courseId, studentId) — re-entering marks for the same
 * student/course/term replaces the row, never duplicates it. */
@Table({ tableName: 'ExamMarks', timestamps: true })
export class ExamMark extends Model {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  declare id: string;

  @ForeignKey(() => ExamTerm)
  @AllowNull(false)
  @Column(DataType.UUID)
  declare examTermId: string;

  @BelongsTo(() => ExamTerm)
  declare examTerm?: ExamTerm;

  @ForeignKey(() => Course)
  @AllowNull(false)
  @Column(DataType.UUID)
  declare courseId: string;

  @BelongsTo(() => Course)
  declare course?: Course;

  @ForeignKey(() => User)
  @AllowNull(false)
  @Column(DataType.UUID)
  declare studentId: string;

  @BelongsTo(() => User, 'studentId')
  declare student?: User;

  @AllowNull(false)
  @Column(DataType.DECIMAL)
  declare marksObtained: number;

  @AllowNull(false)
  @Column(DataType.DECIMAL)
  declare maxMarks: number;

  @ForeignKey(() => User)
  @AllowNull(false)
  @Column(DataType.UUID)
  declare enteredBy: string;

  @BelongsTo(() => User, 'enteredBy')
  declare enteredByUser?: User;
}
