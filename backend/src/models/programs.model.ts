import 'reflect-metadata';
import {
  Table,
  Column,
  Model,
  DataType,
  Default,
  AllowNull,
  PrimaryKey,
  HasMany,
} from 'sequelize-typescript';

import { INSTITUTION_TYPES } from '../constants/index.js';
import type { InstitutionType } from '../types/institution.types.js';
import { Class } from './classes.model.js';

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

  /** e.g. "Affiliated to Tribhuwan University" — set on degree-granting
   * programs, left null for a school/+2 program that isn't externally
   * affiliated. */
  @Default(null)
  @Column(DataType.STRING)
  declare affiliation: string | null;

  /** Short form / abbreviation, e.g. "BIM", "BCSIT". */
  @Default(null)
  @Column(DataType.STRING(10))
  declare abbreviation: string | null;

  @HasMany(() => Class)
  declare classes?: Class[];
}
