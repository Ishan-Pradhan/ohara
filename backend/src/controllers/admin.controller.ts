import type { Response } from 'express';
import { userRepository } from '../repositories/users.repository.js';
import type { AuthRequest } from '../types/auth.types.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/AsyncHandler.js';
import { ok } from '../utils/ApiResponse.js';
import { serializeUser } from '../serializers/user.serializer.js';
import {
  buildPaginationMeta,
  getPaginationParams,
} from '../utils/pagination.utils.js';
import type { PaginationQuery } from '../types/pagination.types.js';

//    GET ALL USERS (ADMIN ONLY)
export const getAllUsers = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const query = (req.validated?.query ?? {}) as PaginationQuery;
    const { page, limit, offset } = getPaginationParams(query);

    const search = String(query.search || '').trim();

    const { rows: users, count: totalItems } =
      await userRepository.findAndCountAll({
        limit,
        offset,
        search,
      });

    const safeUsers = users.map(serializeUser);

    return ok(
      res,
      {
        items: safeUsers,
        meta: buildPaginationMeta({
          totalItems,
          page,
          limit,
          itemCount: safeUsers.length,
        }),
      },
      'Users retrieved successfully',
    );
  },
);

//   GET USER STATS (ADMIN ONLY)
export const getUserStats = asyncHandler(
  async (_req: AuthRequest, res: Response) => {
    const { totalUsers, blockedCount, adminsCount } =
      await userRepository.getUsersStats();

    return ok(
      res,
      {
        totalUsers: totalUsers,
        blockedUsers: blockedCount,
        adminUsers: adminsCount,
      },
      'User stats retrieved successfully',
    );
  },
);

// BLOCK / UNBLOCK USER
export const blockAndUnblockUser = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { id: userId } = req.validated?.params as { id: string };

    const user = await userRepository.findById(userId);

    if (!user) {
      throw new ApiError(404, 'User not found');
    }

    const newStatus = !user.isBlocked;
    user.isBlocked = newStatus;

    await user.save();

    return ok(
      res,
      null,
      `User ${newStatus ? 'blocked' : 'unblocked'} successfully`,
    );
  },
);

// ARCHIVE USER (SOFT REMOVAL)
export const archiveUser = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { id } = req.validated?.params as { id: string };

    const existing = await userRepository.findById(id);
    if (!existing) {
      throw new ApiError(404, 'User not found');
    }
    if (existing.role !== 'student') {
      throw new ApiError(400, 'Only student accounts can be archived through this endpoint');
    }

    const user = await userRepository.archive(id);
    if (!user) {
      throw new ApiError(404, 'User not found');
    }

    return ok(res, serializeUser(user), 'User archived successfully');
  },
);

// HARD DELETE USER (RARE, ADMIN-ONLY)
export const hardDeleteUser = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { id } = req.validated?.params as { id: string };

    const user = await userRepository.findById(id);
    if (!user) {
      throw new ApiError(404, 'User not found');
    }
    if (user.role !== 'student') {
      throw new ApiError(400, 'Only student accounts can be hard-deleted through this endpoint');
    }

    await userRepository.hardDelete(id);

    return ok(res, null, 'User permanently deleted');
  },
);
