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

import type { AttendanceStatus } from '../types/attendance.types.js';
import { AttendanceSession } from './attendanceSessions.model.js';
import { User } from './users.model.js';

@Table({ tableName: 'AttendanceRecords', timestamps: true })
export class AttendanceRecord extends Model {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  declare id: string;

  @ForeignKey(() => AttendanceSession)
  @AllowNull(false)
  @Column(DataType.UUID)
  declare sessionId: string;

  @BelongsTo(() => AttendanceSession)
  declare session?: AttendanceSession;

  @ForeignKey(() => User)
  @AllowNull(false)
  @Column(DataType.UUID)
  declare studentId: string;

  @BelongsTo(() => User)
  declare student?: User;

  @AllowNull(false)
  @Column(DataType.ENUM('present', 'absent', 'late'))
  declare status: AttendanceStatus;

  /** Reason for absence or late arrival, e.g. "sick", "family emergency". */
  @Default(null)
  @Column(DataType.STRING(255))
  declare reason: string | null;
}
