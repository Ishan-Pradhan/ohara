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

import type { EventAudience } from '../types/events.types.js';
import { User } from './users.model.js';
import { Program } from './programs.model.js';
import { Class } from './classes.model.js';
import { Section } from './sections.model.js';
import { Course } from './courses.model.js';

@Table({ tableName: 'Events', timestamps: true })
export class Event extends Model {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  declare id: string;

  @ForeignKey(() => User)
  @AllowNull(false)
  @Column(DataType.UUID)
  declare createdBy: string;

  @BelongsTo(() => User)
  declare creator?: User;

  @AllowNull(false)
  @Column(DataType.STRING)
  declare title: string;

  @Column(DataType.TEXT)
  declare description: string | null;

  @AllowNull(false)
  @Column(DataType.DATE)
  declare startAt: Date;

  @AllowNull(false)
  @Column(DataType.ENUM('global', 'program', 'class', 'section', 'course'))
  declare audience: EventAudience;

  @ForeignKey(() => Program)
  @Column(DataType.UUID)
  declare programId: string | null;

  @BelongsTo(() => Program)
  declare program?: Program;

  @ForeignKey(() => Class)
  @Column(DataType.UUID)
  declare classId: string | null;

  @BelongsTo(() => Class)
  declare class?: Class;

  @ForeignKey(() => Section)
  @Column(DataType.UUID)
  declare sectionId: string | null;

  @BelongsTo(() => Section)
  declare section?: Section;

  @ForeignKey(() => Course)
  @Column(DataType.UUID)
  declare courseId: string | null;

  @BelongsTo(() => Course)
  declare course?: Course;
}
