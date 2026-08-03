import 'reflect-metadata';
import {
  Table,
  Column,
  Model,
  DataType,
  Default,
  AllowNull,
  PrimaryKey,
} from 'sequelize-typescript';

import { INSTITUTION_TYPES } from '../constants/index.js';
import type { InstitutionType } from '../types/institution.types.js';

@Table({ tableName: 'Programs', timestamps: true })
export class Program extends Model {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  declare id: string;

  @AllowNull(false)
  @Column(DataType.STRING)
  declare name: string;

  @AllowNull(false)
  @Column(
    DataType.ENUM(
      INSTITUTION_TYPES.SCHOOL,
      INSTITUTION_TYPES.COLLEGE,
      INSTITUTION_TYPES.UNIVERSITY,
    ),
  )
  declare institutionType: InstitutionType;

  @Default(null)
  @Column(DataType.STRING)
  declare description: string | null;
}
