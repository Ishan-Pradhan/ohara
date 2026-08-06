import type { Optional } from 'sequelize';
import type { USER_ROLES, USER_STATUS } from '../constants/index.js';

export type UserRole = (typeof USER_ROLES)[keyof typeof USER_ROLES];
export type UserStatus = (typeof USER_STATUS)[keyof typeof USER_STATUS];

export interface Users {
  id: string;
  email: string;
  password: string;
  name: string;
  avatarUrl: string | null;
  role: UserRole;
  status: UserStatus;
  deletedAt: Date | null;
  isVerified: boolean;
  isBlocked: boolean;
  authProvider: 'local' | 'google' | 'github';
  refreshToken: string | null;
  dateOfBirth: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export type UserCreationAttributes = Optional<
  Users,
  | 'id'
  | 'avatarUrl'
  | 'role'
  | 'status'
  | 'deletedAt'
  | 'isVerified'
  | 'isBlocked'
  | 'authProvider'
  | 'refreshToken'
  | 'dateOfBirth'
  | 'createdAt'
  | 'updatedAt'
>;

