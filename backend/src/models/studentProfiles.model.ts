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
} from 'sequelize-typescript';

import { User } from './users.model.js';

/** One row per student, created lazily by the admission form only when at
 * least one KYC field is provided — not every student has one. */
@Table({ tableName: 'StudentProfiles', timestamps: true })
export class StudentProfile extends Model {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  declare id: string;

  @ForeignKey(() => User)
  @AllowNull(false)
  @Unique
  @Column(DataType.UUID)
  declare userId: string;

  @BelongsTo(() => User)
  declare user?: User;

  @Default(null)
  @Column(DataType.STRING)
  declare parentName: string | null;

  @Default(null)
  @Column(DataType.STRING)
  declare parentPhone: string | null;

  @Default(null)
  @Column(DataType.STRING)
  declare address: string | null;

  @Default(null)
  @Column(DataType.DATEONLY)
  declare dateOfBirth: string | null;

  @Default(null)
  @Column(DataType.STRING)
  declare previousSchool: string | null;

  @Default(null)
  @Column(DataType.STRING)
  declare studentPhone: string | null;
}
