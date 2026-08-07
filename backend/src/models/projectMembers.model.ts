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

import { Project } from './projects.model.js';
import { User } from './users.model.js';

/** The teacher-defined roster for a course team project — only these
 * students (plus the course's teachers/admin) can see or work on the
 * project. Unique per (projectId, studentId). */
@Table({ tableName: 'ProjectMembers', timestamps: true })
export class ProjectMember extends Model {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  declare id: string;

  @ForeignKey(() => Project)
  @AllowNull(false)
  @Column(DataType.UUID)
  declare projectId: string;

  @BelongsTo(() => Project)
  declare project?: Project;

  @ForeignKey(() => User)
  @AllowNull(false)
  @Column(DataType.UUID)
  declare studentId: string;

  @BelongsTo(() => User, 'studentId')
  declare student?: User;
}
