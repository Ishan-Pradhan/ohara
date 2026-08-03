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

import { Program } from './programs.model.js';
import { Section } from './sections.model.js';
import { Course } from './courses.model.js';

@Table({ tableName: 'Classes', timestamps: true })
export class Class extends Model {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  declare id: string;

  @ForeignKey(() => Program)
  @AllowNull(false)
  @Column(DataType.UUID)
  declare programId: string;

  @BelongsTo(() => Program)
  declare program?: Program;

  @AllowNull(false)
  @Column(DataType.STRING)
  declare name: string;

  @AllowNull(false)
  @Column(DataType.INTEGER)
  declare orderIndex: number;

  @HasMany(() => Section)
  declare sections?: Section[];

  @HasMany(() => Course)
  declare courses?: Course[];
}
