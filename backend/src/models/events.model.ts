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

import type { EventAudience, EventType } from '../types/events.types.js';
import type { InstitutionType } from '../types/institution.types.js';
import { User } from './users.model.js';
import { Program } from './programs.model.js';
import { Class } from './classes.model.js';

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
  @Default('event')
  @Column(DataType.ENUM('event', 'holiday', 'exam'))
  declare type: EventType;

  @AllowNull(false)
  @Column(DataType.DATE)
  declare startAt: Date;

  @Column(DataType.DATE)
  declare endAt: Date | null;

  @AllowNull(false)
  @Default(false)
  @Column(DataType.BOOLEAN)
  declare allDay: boolean;

  @AllowNull(false)
  @Column(DataType.ENUM('global', 'institution_type', 'program', 'class'))
  declare audience: EventAudience;

  @Column(DataType.ENUM('school', 'college', 'university'))
  declare institutionType: InstitutionType | null;

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
}
