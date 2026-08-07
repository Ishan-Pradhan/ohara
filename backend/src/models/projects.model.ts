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
import { BoardColumn } from './boardColumns.model.js';
import { ProjectMember } from './projectMembers.model.js';

/** Either a course team project (`courseId` set, visibility via
 * `ProjectMembers`) or a student's personal board (`ownerId` set,
 * `courseId` null, visible only to that student). `type` disambiguates
 * rather than making callers infer it from which FK is populated. */
@Table({ tableName: 'Projects', timestamps: true })
export class Project extends Model {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  declare id: string;

  @ForeignKey(() => Course)
  @Column(DataType.UUID)
  declare courseId: string | null;

  @BelongsTo(() => Course)
  declare course?: Course;

  @ForeignKey(() => User)
  @Column(DataType.UUID)
  declare ownerId: string | null;

  @BelongsTo(() => User, 'ownerId')
  declare owner?: User;

  @AllowNull(false)
  @Default('course')
  @Column(DataType.ENUM('course', 'personal'))
  declare type: 'course' | 'personal';

  @AllowNull(false)
  @Column(DataType.STRING)
  declare name: string;

  @ForeignKey(() => User)
  @AllowNull(false)
  @Column(DataType.UUID)
  declare createdBy: string;

  @BelongsTo(() => User, 'createdBy')
  declare creator?: User;

  @HasMany(() => BoardColumn)
  declare columns?: BoardColumn[];

  @HasMany(() => ProjectMember)
  declare members?: ProjectMember[];
}
