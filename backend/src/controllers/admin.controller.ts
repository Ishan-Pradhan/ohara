import type { Response } from 'express';
import { userRepository } from '../repositories/users.repository.js';
import { studentProfileRepository } from '../repositories/studentProfiles.repository.js';
import { verificationRepository } from '../repositories/verification.repository.js';
import { institutionProfileRepository } from '../repositories/institutionProfile.repository.js';
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
import type { UserRole } from '../types/users.types.js';
import { TWENTY_FOUR_HOURS_IN_MS } from '../constants/index.js';
import { generateToken, hashPassword } from '../utils/security.utils.js';
import { getGravatar } from '../utils/gravatar.utils.js';
import { sendStaffInviteEmail } from '../services/email.service.js';
import { deleteBlockersRepository } from '../repositories/deleteBlockers.repository.js';
import { assertDeletable } from '../utils/deleteBlockers.utils.js';
import { logger } from '../utils/logger.js';

//    GET ALL USERS (ADMIN ONLY)
export const getAllUsers = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const query = (req.validated?.query ?? {}) as PaginationQuery & { role?: UserRole };
    const { page, limit, offset } = getPaginationParams(query);

    const search = String(query.search || '').trim();

    const { rows: users, count: totalItems } =
      await userRepository.findAndCountAll({
        limit,
        offset,
        search,
        role: query.role,
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

type InvitableRole = 'teacher' | 'admin' | 'student';

/** Shared by the single-account invite (createStaff) and the batch invite
 * (inviteUsersBatch): creates one unverified account with an unguessable
 * placeholder password and emails a set-password link. The invitee can only
 * reach an authenticated session via that link, which also flips
 * isVerified (auth.controller.ts resetPassword). Throws ApiError(400) on a
 * duplicate email — callers decide whether that's fatal or a skippable row. */
export const inviteUser = async (
  name: string,
  email: string,
  role: InvitableRole,
  institutionName: string,
) => {
  const existing = await userRepository.findByEmail(email);
  if (existing) {
    throw new ApiError(400, 'Email already exists');
  }

  const placeholderPassword = await hashPassword(generateToken());

  const user = await userRepository.create({
    name,
    email,
    password: placeholderPassword,
    avatarUrl: getGravatar(email),
    role,
  });

  const resetToken = generateToken();
  const expiresAt = new Date(Date.now() + TWENTY_FOUR_HOURS_IN_MS);
  await verificationRepository.deletePasswordResetTokensForUser(user.id);
  await verificationRepository.createPasswordResetToken(user.id, resetToken, expiresAt);

  try {
    await sendStaffInviteEmail(user.email, user.name, role, resetToken, institutionName);
  } catch (emailError) {
    logger.error({ err: emailError, email: user.email }, 'Failed to send invite email');
  }

  return user;
};

// CREATE TEACHER OR ADMIN ACCOUNT (ADMIN ONLY)
// Students self-register (auth.controller.ts) or are batch-invited
// (inviteUsersBatch below). This is the only path to a teacher or admin
// account.
export const createStaff = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { name, email, role } = req.validated?.body as {
      name: string;
      email: string;
      role: 'teacher' | 'admin';
    };

    const profile = await institutionProfileRepository.get();
    const user = await inviteUser(name, email, role, profile?.name ?? 'Ohara');

    return ok(res, serializeUser(user), 'Account created and invite sent', 201);
  },
);

// BATCH-INVITE ACCOUNTS (ADMIN ONLY)
// Typically a whole class of students at once — see FR-1d. One bad row
// (duplicate email, etc.) doesn't fail the rest of the batch.
export const inviteUsersBatch = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { role, users } = req.validated?.body as {
      role: InvitableRole;
      users: { name: string; email: string }[];
    };

    const profile = await institutionProfileRepository.get();
    const institutionName = profile?.name ?? 'Ohara';

    const invited: ReturnType<typeof serializeUser>[] = [];
    const skipped: { email: string; reason: string }[] = [];

    for (const row of users) {
      try {
        const user = await inviteUser(row.name, row.email, role, institutionName);
        invited.push(serializeUser(user));
      } catch (err) {
        skipped.push({
          email: row.email,
          reason: err instanceof ApiError ? err.message : 'Could not create this account',
        });
      }
    }

    return ok(
      res,
      { invited, skipped },
      `Invited ${invited.length} of ${users.length}`,
      201,
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

// RESTORE USER (UN-ARCHIVE)
// Reverses archiveUser: an archived/inactive student is returned to active
// (login access restored, deleted_at cleared). Graduated stays graduated.
export const restoreUser = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { id } = req.validated?.params as { id: string };

    const existing = await userRepository.findById(id);
    if (!existing) {
      throw new ApiError(404, 'User not found');
    }
    if (existing.role !== 'student') {
      throw new ApiError(400, 'Only student accounts can be restored through this endpoint');
    }
    if (existing.status === 'graduated') {
      throw new ApiError(
        400,
        'This student is graduated — restoring an archived student is supported, but graduation is an academic record that cannot be reversed',
      );
    }

    const user = await userRepository.restore(id);
    if (!user) {
      throw new ApiError(404, 'User not found');
    }

    return ok(res, serializeUser(user), 'User restored successfully');
  },
);

// SET DATE OF BIRTH (feeds the admin birthday calendar)
export const setDateOfBirth = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { id } = req.validated?.params as { id: string };
    const { dateOfBirth } = req.validated?.body as { dateOfBirth: string };

    const existing = await userRepository.findById(id);
    if (!existing) {
      throw new ApiError(404, 'User not found');
    }

    if (existing.role === 'student') {
      await studentProfileRepository.upsert(id, { dateOfBirth });
    } else {
      await userRepository.updateDateOfBirth(id, dateOfBirth);
    }

    return ok(res, { id, dateOfBirth }, 'Date of birth updated');
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

    const blockers = await deleteBlockersRepository.studentBlockers(id);
    assertDeletable('student', blockers);

    await userRepository.hardDelete(id);

    return ok(res, null, 'User permanently deleted');
  },
);
