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

/** A private note a teacher leaves for themselves about a student they
 * teach — e.g. a behavioral observation. Visible only to the teacher who
 * wrote it; not shared with other teachers or surfaced to the student. See
 * teacherStudentNotes.controller.ts for the ownership checks. */
@Table({ tableName: 'TeacherStudentNotes', timestamps: true })
export class TeacherStudentNote extends Model {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  declare id: string;

  @ForeignKey(() => User)
  @AllowNull(false)
  @Column(DataType.UUID)
  declare teacherId: string;

  @BelongsTo(() => User, 'teacherId')
  declare teacher?: User;

  @ForeignKey(() => User)
  @AllowNull(false)
  @Column(DataType.UUID)
  declare studentId: string;

  @BelongsTo(() => User, 'studentId')
  declare student?: User;

  @AllowNull(false)
  @Column(DataType.TEXT)
  declare content: string;
}
