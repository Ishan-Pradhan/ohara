import type { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';
import type { AuthRequest, JwtPayload } from '../types/auth.types.js';
import type { UserRole } from '../types/users.types.js';
import { userRepository } from '../repositories/users.repository.js';
import { courseTeacherRepository } from '../repositories/courseTeachers.repository.js';

export const verifyJWT = async (
  req: AuthRequest,
  _res: Response,
  next: NextFunction,
) => {
  const token =
    req.cookies?.accessToken ||
    req.header('Authorization')?.replace('Bearer ', '');

  if (!token) {
    throw new ApiError(401, 'Unauthorized request');
  }

  try {
    const decodedToken = jwt.verify(
      token,
      env.ACCESS_TOKEN_SECRET,
    ) as JwtPayload;
    const user = await userRepository.findById(decodedToken.id);
    if (!user) throw new ApiError(401, 'User not found');

    req.user = user;
    next();
  } catch (error) {
    if (error instanceof Error && error.name === 'TokenExpiredError') {
      throw new ApiError(401, 'Access token has expired');
    }
    throw new ApiError(401, 'Invalid access token');
  }
};

export const requireRole =
  (...roles: UserRole[]) =>
  (req: AuthRequest, _res: Response, next: NextFunction): void => {
    const user = req.user;

    if (!user) {
      throw new ApiError(401, 'Unauthorized request');
    }

    if (!roles.includes(user.role)) {
      throw new ApiError(403, 'Unauthorized request');
    }

    next();
  };

export const checkBlockedUser = async (
  req: AuthRequest,
  _res: Response,
  next: NextFunction,
) => {
  const user = req.user;

  if (!user) {
    throw new ApiError(404, 'User not found');
  }

  if (user.isBlocked) {
    throw new ApiError(403, 'User is blocked');
  }
  next();
};

/**
 * Course-scoped ownership guard (FR-4). Admins always pass. Otherwise the
 * caller must be an assigned teacher for `req.params.courseId` — every
 * course-scoped route (Phase 3+) must name that param `:courseId`.
 */
export const requireCourseTeacher = async (
  req: AuthRequest,
  _res: Response,
  next: NextFunction,
) => {
  const user = req.user;
  if (!user) {
    throw new ApiError(401, 'Unauthorized request');
  }

  if (user.role === 'admin') {
    return next();
  }

  // req.params is typed as Record<string, string> with an index signature, so
  // under noUncheckedIndexedAccess a named lookup widens to `string |
  // undefined` even though Express always populates a matched route param.
  // Cast rather than leave an unreachable undefined-check, same as the
  // req.validated.params casts used elsewhere in these controllers.
  const { courseId } = req.params as { courseId: string };
  const isAssigned = await courseTeacherRepository.exists(user.id, courseId);
  if (!isAssigned) {
    throw new ApiError(403, 'Not authorized for this course');
  }

  next();
};
