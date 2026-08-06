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

import { Section } from './sections.model.js';

@Table({ tableName: 'AcademicYears', timestamps: true })
export class AcademicYear extends Model {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  declare id: string;

  @AllowNull(false)
  @Column(DataType.STRING)
  declare name: string;

  @AllowNull(false)
  @Column(DataType.DATEONLY)
  declare startDate: string;

  @AllowNull(false)
  @Column(DataType.DATEONLY)
  declare endDate: string;

  @AllowNull(false)
  @Default(false)
  @Column(DataType.BOOLEAN)
  declare isCurrent: boolean;

  /** Odd/even semesters run on offset calendars for college/university
   * programs — `isCurrent` is unique per `term`, not globally, so "26/27
   * odd" and "26/27 even" can both be current at once. `annual` is what
   * schools use (no odd/even split). */
  @AllowNull(false)
  @Default('annual')
  @Column(DataType.ENUM('odd', 'even', 'annual'))
  declare term: 'odd' | 'even' | 'annual';

  @HasMany(() => Section)
  declare sections?: Section[];
}
