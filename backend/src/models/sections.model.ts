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

import { Class } from './classes.model.js';
import { AcademicYear } from './academicYears.model.js';
import { User } from './users.model.js';

@Table({ tableName: 'Sections', timestamps: true })
export class Section extends Model {
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

  @ForeignKey(() => AcademicYear)
  @AllowNull(false)
  @Column(DataType.UUID)
  declare academicYearId: string;

  @BelongsTo(() => AcademicYear)
  declare academicYear?: AcademicYear;

  @ForeignKey(() => User)
  @Default(null)
  @Column(DataType.UUID)
  declare classTeacherId: string | null;

  @BelongsTo(() => User)
  declare classTeacher?: User;

  @AllowNull(false)
  @Column(DataType.STRING)
  declare name: string;
}
