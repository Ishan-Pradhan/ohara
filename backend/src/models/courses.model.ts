import 'reflect-metadata';
import {
  Table,
  Column,
  Model,
  DataType,
  Default,
  AllowNull,
  Unique,
  PrimaryKey,
  ForeignKey,
  BelongsTo,
  BelongsToMany,
  HasMany,
} from 'sequelize-typescript';

import { Class } from './classes.model.js';
import { User } from './users.model.js';
import { CourseTeacher } from './courseTeachers.model.js';
import { Module } from './modules.model.js';

@Table({ tableName: 'Courses', timestamps: true })
export class Course extends Model {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  declare id: string;

  @ForeignKey(() => Class)
  @AllowNull(false)
  @Column(DataType.UUID)
  declare classId: string;

  @BelongsTo(() => Class)
  declare class?: Class;

  @AllowNull(false)
  @Column(DataType.STRING)
  declare title: string;

  @AllowNull(false)
  @Unique
  @Column(DataType.STRING)
  declare code: string;

  @Default(null)
  @Column(DataType.STRING)
  declare description: string | null;

  /** A course isn't teachable through the portal until a teacher publishes
   * its generated/edited structure — see FR-18. */
  @AllowNull(false)
  @Default(false)
  @Column(DataType.BOOLEAN)
  declare isPublished: boolean;

  @AllowNull(false)
  @Default('compulsory')
  @Column(DataType.ENUM('compulsory', 'elective'))
  declare courseType: 'compulsory' | 'elective';

  /** Seat cap for self-enrolled electives. Null means uncapped — mirrors
   * Section.capacity. Meaningless for compulsory courses (auto-enroll never
   * checks it), but the column isn't restricted to electives at the DB level. */
  @Default(null)
  @Column(DataType.INTEGER)
  declare capacity: number | null;

  @BelongsToMany(() => User, () => CourseTeacher)
  declare teachers?: User[];

  @HasMany(() => Module)
  declare modules?: Module[];
}
