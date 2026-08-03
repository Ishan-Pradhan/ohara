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
}
