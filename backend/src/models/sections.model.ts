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

@Table({ tableName: 'Sections', timestamps: true })
export class Section extends Model {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  declare id: string;

  @AllowNull(false)
  @Column(DataType.UUID)
  declare classId: string;

  @AllowNull(false)
  @Column(DataType.UUID)
  declare academicYearId: string;

  @Default(null)
  @Column(DataType.UUID)
  declare classTeacherId: string | null;

  @AllowNull(false)
  @Column(DataType.STRING)
  declare name: string;
}
