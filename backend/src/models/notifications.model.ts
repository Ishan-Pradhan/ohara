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

import type { NotificationType } from '../types/notifications.types.js';
import { User } from './users.model.js';

@Table({ tableName: 'Notifications', timestamps: true })
export class Notification extends Model {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  declare id: string;

  @ForeignKey(() => User)
  @AllowNull(false)
  @Column(DataType.UUID)
  declare userId: string;

  @BelongsTo(() => User)
  declare user?: User;

  @AllowNull(false)
  @Column(
    DataType.ENUM('assignment_created', 'assignment_graded', 'quiz_published', 'quiz_graded'),
  )
  declare type: NotificationType;

  @AllowNull(false)
  @Column(DataType.STRING)
  declare title: string;

  @Column(DataType.TEXT)
  declare body: string | null;

  @Column(DataType.STRING)
  declare link: string | null;

  @AllowNull(false)
  @Default(false)
  @Column(DataType.BOOLEAN)
  declare isRead: boolean;
}
