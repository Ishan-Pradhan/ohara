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

import { Module } from './modules.model.js';

@Table({ tableName: 'Lessons', timestamps: true })
export class Lesson extends Model {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  declare id: string;

  @ForeignKey(() => Module)
  @AllowNull(false)
  @Column(DataType.UUID)
  declare moduleId: string;

  @BelongsTo(() => Module)
  declare module?: Module;

  @AllowNull(false)
  @Column(DataType.STRING)
  declare title: string;

  @AllowNull(false)
  @Column(DataType.TEXT)
  declare content: string;

  @AllowNull(false)
  @Default([])
  @Column(DataType.ARRAY(DataType.STRING))
  declare keyTopics: string[];

  @AllowNull(false)
  @Column(DataType.INTEGER)
  declare orderIndex: number;
}
