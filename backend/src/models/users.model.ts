import { DataTypes } from 'sequelize';

import { sequelize } from '../config/db.js';
import type { UserInstance } from '../types/users.types.js';
import { USER_ROLES, USER_STATUS } from '../constants/index.js';

export const User = sequelize.define<UserInstance>(
  'User',
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    password: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    avatarUrl: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: null,
    },
    role: {
      type: DataTypes.ENUM(
        USER_ROLES.ADMIN,
        USER_ROLES.TEACHER,
        USER_ROLES.STUDENT,
        USER_ROLES.ALUMNI,
      ),
      defaultValue: USER_ROLES.STUDENT,
    },
    status: {
      type: DataTypes.ENUM(
        USER_STATUS.ACTIVE,
        USER_STATUS.INACTIVE,
        USER_STATUS.GRADUATED,
        USER_STATUS.ARCHIVED,
      ),
      allowNull: false,
      defaultValue: USER_STATUS.ACTIVE,
    },
    deletedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: null,
    },
    isVerified: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    isBlocked: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    authProvider: {
      type: DataTypes.ENUM('local', 'google', 'github'),
      defaultValue: 'local',
    },
    refreshToken: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: null,
    },
  },
  {
    tableName: 'Users',
    timestamps: true,
    defaultScope: {
      attributes: { exclude: ['password', 'refreshToken'] },
    },
  },
);
