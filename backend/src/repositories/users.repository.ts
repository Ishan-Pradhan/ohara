import { Op, type Transaction, type WhereOptions } from 'sequelize';
import { User } from '../models/users.model.js';
import { USER_STATUS } from '../constants/index.js';
import type {
  UserCreationAttributes,
  Users,
  UserStatus,
} from '../types/users.types.js';

const buildUserWhere = (search?: string): WhereOptions<Users> => {
  if (!search) return {};

  return {
    [Op.or]: [
      { name: { [Op.iLike]: `%${search}%` } },
      { email: { [Op.iLike]: `%${search}%` } },
    ],
  };
};

export const userRepository = {
  findAll: async (options?: {
    limit?: number;
    offset?: number;
    search?: string;
  }) => {
    const { limit, offset, search } = options || {};

    return await User.findAll({
      where: buildUserWhere(search),
      order: [['createdAt', 'DESC']],
      ...(limit !== undefined && { limit }),
      ...(offset !== undefined && { offset }),
    });
  },

  findAndCountAll: async (options?: {
    limit?: number;
    offset?: number;
    search?: string;
  }) => {
    const { limit, offset, search } = options || {};

    return await User.findAndCountAll({
      where: buildUserWhere(search),
      ...(limit !== undefined && { limit }),
      ...(offset !== undefined && { offset }),
      order: [['createdAt', 'DESC']],
    });
  },

  count: async (options?: { search?: string }) => {
    const { search } = options || {};

    return await User.count({ where: buildUserWhere(search) });
  },

  findById: async (id: string) => {
    return await User.findByPk(id);
  },

  findByIdWithSecrets: async (id: string) => {
    return await User.unscoped().findByPk(id);
  },

  findByEmail: async (email: string) => {
    return await User.findOne({ where: { email } });
  },

  // Bypasses the defaultScope (which excludes `password`) — use ONLY for login
  findByEmailWithPassword: async (email: string) => {
    return await User.unscoped().findOne({ where: { email } });
  },

  create: async (userData: UserCreationAttributes): Promise<User> => {
    return await User.create(userData);
  },

  getUsersStats: async () => {
    const totalUsers = await User.count();
    const blockedCount = await User.count({ where: { isBlocked: true } });
    const adminsCount = await User.count({ where: { role: 'admin' } });

    return {
      totalUsers,
      blockedCount,
      adminsCount,
    };
  },

  /** Any status change invalidates outstanding refresh tokens — a safe default. */
  updateStatus: async (id: string, status: UserStatus): Promise<User | null> => {
    const user = await User.findByPk(id);
    if (!user) return null;
    user.status = status;
    user.refreshToken = null;
    await user.save();
    return user;
  },

  /** Same-transaction variant of `updateStatus`, used by composed repository
   * methods (e.g. `classMembershipRepository.graduate`) that must land the
   * user-status write and a related row write atomically. */
  updateStatusInTransaction: async (
    id: string,
    status: UserStatus,
    transaction: Transaction,
  ): Promise<void> => {
    await User.update(
      { status, refreshToken: null },
      { where: { id }, transaction },
    );
  },

  /** Soft-removal: archives the account, stamps `deletedAt`, and revokes
   * outstanding refresh tokens. Used instead of `updateStatus` specifically
   * for archiving (see admin.controller.ts's `archiveUser`). */
  archive: async (id: string): Promise<User | null> => {
    const user = await User.findByPk(id);
    if (!user) return null;
    user.status = USER_STATUS.ARCHIVED;
    user.deletedAt = new Date();
    user.refreshToken = null;
    await user.save();
    return user;
  },

  /** Real hard delete — `Users` isn't `paranoid`, so `.destroy()` removes the row.
   * Any RESTRICT-guarded FK still pointing at this user (class_memberships, enrollments)
   * throws `ForeignKeyConstraintError`, which error.middleware.ts now maps to a clean 409. */
  hardDelete: async (id: string): Promise<boolean> => {
    const deleted = await User.destroy({ where: { id } });
    return deleted > 0;
  },
};
