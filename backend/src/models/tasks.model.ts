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

import { BoardColumn } from './boardColumns.model.js';
import { User } from './users.model.js';

@Table({ tableName: 'Tasks', timestamps: true })
export class Task extends Model {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  declare id: string;

  @ForeignKey(() => BoardColumn)
  @AllowNull(false)
  @Column(DataType.UUID)
  declare columnId: string;

  @BelongsTo(() => BoardColumn)
  declare column?: BoardColumn;

  @AllowNull(false)
  @Column(DataType.STRING)
  declare title: string;

  @Column(DataType.TEXT)
  declare description: string | null;

  @ForeignKey(() => User)
  @Column(DataType.UUID)
  declare assigneeId: string | null;

  @BelongsTo(() => User)
  declare assignee?: User;

  @AllowNull(false)
  @Column(DataType.INTEGER)
  declare orderIndex: number;
}
