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

@Table({ tableName: 'CourseTeachers', timestamps: true })
export class CourseTeacher extends Model {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  declare id: string;

  @AllowNull(false)
  @Column(DataType.UUID)
  declare teacherId: string;

  @AllowNull(false)
  @Column(DataType.UUID)
  declare courseId: string;
}
