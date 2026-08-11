import type { Response } from 'express';

import type { AuthRequest } from '../types/auth.types.js';
import { studentProfileRepository } from '../repositories/studentProfiles.repository.js';
import { asyncHandler } from '../utils/AsyncHandler.js';
import { ok } from '../utils/ApiResponse.js';
import { ApiError } from '../utils/ApiError.js';

const serializeProfile = (profile: {
  id: string;
  userId: string;
  parentName: string | null;
  parentPhone: string | null;
  address: string | null;
  dateOfBirth: string | null;
  previousSchool: string | null;
  studentPhone: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}) => ({
  id: profile.id,
  userId: profile.userId,
  parentName: profile.parentName,
  parentPhone: profile.parentPhone,
  address: profile.address,
  dateOfBirth: profile.dateOfBirth,
  previousSchool: profile.previousSchool,
  studentPhone: profile.studentPhone,
  createdAt: profile.createdAt?.toISOString() ?? new Date().toISOString(),
  updatedAt: profile.updatedAt?.toISOString() ?? new Date().toISOString(),
});

export const getMyProfile = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const studentId = req.user?.id;
    if (!studentId) {
      throw new ApiError(401, 'Unauthorized');
    }

    const profile = await studentProfileRepository.findByUserId(studentId);
    return ok(res, profile ? serializeProfile(profile) : null, 'Profile retrieved');
  },
);

export const updateMyProfile = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const studentId = req.user?.id;
    if (!studentId) {
      throw new ApiError(401, 'Unauthorized');
    }

    const body = req.validated?.body as {
      parentName?: string | null;
      parentPhone?: string | null;
      address?: string | null;
      dateOfBirth?: string | null;
      previousSchool?: string | null;
      studentPhone?: string | null;
    };

    const profile = await studentProfileRepository.upsert(studentId, body);
    return ok(res, serializeProfile(profile), 'Profile updated');
  },
);
