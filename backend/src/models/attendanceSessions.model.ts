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

import { Course } from './courses.model.js';
import { User } from './users.model.js';
import { Section } from './sections.model.js';
import { AttendanceRecord } from './attendanceRecords.model.js';

@Table({ tableName: 'AttendanceSessions', timestamps: true })
export class AttendanceSession extends Model {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  declare id: string;

  @ForeignKey(() => Course)
  @AllowNull(false)
  @Column(DataType.UUID)
  declare courseId: string;

  @BelongsTo(() => Course)
  declare course?: Course;

  /** Nullable at the DB level for a handful of pre-existing rows from before
   * attendance was section-scoped; every new session is required (by Zod)
   * to set this — a course can be taught to more than one section of its
   * class, and a session is always for one specific class meeting. */
  @ForeignKey(() => Section)
  @Column(DataType.UUID)
  declare sectionId: string | null;

  @BelongsTo(() => Section)
  declare section?: Section;

  @AllowNull(false)
  @Column(DataType.DATEONLY)
  declare sessionDate: string;

  @ForeignKey(() => User)
  @AllowNull(false)
  @Column(DataType.UUID)
  declare createdBy: string;

  @BelongsTo(() => User)
  declare creator?: User;

  @HasMany(() => AttendanceRecord)
  declare records?: AttendanceRecord[];
}
