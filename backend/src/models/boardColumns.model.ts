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

import { Project } from './projects.model.js';
import { Task } from './tasks.model.js';

@Table({ tableName: 'BoardColumns', timestamps: true })
export class BoardColumn extends Model {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  declare id: string;

  @ForeignKey(() => Project)
  @AllowNull(false)
  @Column(DataType.UUID)
  declare projectId: string;

  @BelongsTo(() => Project)
  declare project?: Project;

  @AllowNull(false)
  @Column(DataType.STRING)
  declare name: string;

  @AllowNull(false)
  @Column(DataType.INTEGER)
  declare orderIndex: number;

  @HasMany(() => Task)
  declare tasks?: Task[];
}
