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
  DefaultScope,
} from 'sequelize-typescript';

import { USER_ROLES, USER_STATUS } from '../constants/index.js';
import type { UserRole, UserStatus } from '../types/users.types.js';

// Secrets are excluded by default. Repositories that genuinely need them
// (login, token rotation) opt in with User.unscoped().
@DefaultScope(() => ({
  attributes: { exclude: ['password', 'refreshToken'] },
}))
@Table({ tableName: 'Users', timestamps: true })
export class User extends Model {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  declare id: string;

  @AllowNull(false)
  @Unique
  @Column(DataType.STRING)
  declare email: string;

  @AllowNull(false)
  @Column(DataType.STRING)
  declare password: string;

  @AllowNull(false)
  @Column(DataType.STRING)
  declare name: string;

  @Default(null)
  @Column(DataType.STRING)
  declare avatarUrl: string | null;

  @Default(USER_ROLES.STUDENT)
  @Column(
    DataType.ENUM(
      USER_ROLES.ADMIN,
      USER_ROLES.TEACHER,
      USER_ROLES.STUDENT,
      USER_ROLES.ALUMNI,
    ),
  )
  declare role: UserRole;

  @AllowNull(false)
  @Default(USER_STATUS.ACTIVE)
  @Column(
    DataType.ENUM(
      USER_STATUS.ACTIVE,
      USER_STATUS.INACTIVE,
      USER_STATUS.GRADUATED,
      USER_STATUS.ARCHIVED,
    ),
  )
  declare status: UserStatus;

  @Default(false)
  @Column(DataType.BOOLEAN)
  declare isVerified: boolean;

  @Default(false)
  @Column(DataType.BOOLEAN)
  declare isBlocked: boolean;

  @Default('local')
  @Column(DataType.ENUM('local', 'google', 'github'))
  declare authProvider: 'local' | 'google' | 'github';

  @Default(null)
  @Column(DataType.STRING)
  declare refreshToken: string | null;

  @Default(null)
  @Column(DataType.DATE)
  declare deletedAt: Date | null;
}
