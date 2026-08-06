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
