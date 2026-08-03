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
} from 'sequelize-typescript';

@Table({ tableName: 'Courses', timestamps: true })
export class Course extends Model {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  declare id: string;

  @AllowNull(false)
  @Column(DataType.UUID)
  declare classId: string;

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
}
