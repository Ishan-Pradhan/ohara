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

import { STUDENT_FLAG_STATUSES } from '../constants/index.js';
import type { StudentFlagStatus } from '../types/studentFlags.types.js';
import { User } from './users.model.js';
import { Course } from './courses.model.js';
import { Section } from './sections.model.js';

/** A lightweight "check on this student" marker a teacher can raise from a
 * course roster or their section roster — not a lifecycle action, just
 * visibility for admins. See student.controller ownership checks for who
 * may raise one. */
@Table({ tableName: 'StudentFlags', timestamps: true })
export class StudentFlag extends Model {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  declare id: string;

  @ForeignKey(() => User)
  @AllowNull(false)
  @Column(DataType.UUID)
  declare studentId: string;

  @BelongsTo(() => User, 'studentId')
  declare student?: User;

  @ForeignKey(() => User)
  @AllowNull(false)
  @Column(DataType.UUID)
  declare raisedBy: string;

  @BelongsTo(() => User, 'raisedBy')
  declare raiser?: User;

  @ForeignKey(() => Course)
  @Default(null)
  @Column(DataType.UUID)
  declare courseId: string | null;

  @BelongsTo(() => Course)
  declare course?: Course;

  @ForeignKey(() => Section)
  @Default(null)
  @Column(DataType.UUID)
  declare sectionId: string | null;

  @BelongsTo(() => Section)
  declare section?: Section;

  @AllowNull(false)
  @Column(DataType.TEXT)
  declare reason: string;

  @AllowNull(false)
  @Default(STUDENT_FLAG_STATUSES.OPEN)
  @Column(DataType.ENUM(STUDENT_FLAG_STATUSES.OPEN, STUDENT_FLAG_STATUSES.RESOLVED))
  declare status: StudentFlagStatus;
}
