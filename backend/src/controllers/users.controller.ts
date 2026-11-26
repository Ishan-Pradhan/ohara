import { userRepository } from '../repositories/users.repository.js';
import { ApiError } from '../utils/ApiError.js';
import type { Response } from 'express';
import { asyncHandler } from '../utils/AsyncHandler.js';
import { ok } from '../utils/ApiResponse.js';
import { serializeUser } from '../serializers/user.serializer.js';
import type { AuthRequest } from '../types/auth.types.js';

// Controller function to get current user details
export const getCurrentUser = asyncHandler(
  async (req: AuthRequest, res: Response): Promise<Response> => {
    const userId = req.user?.id;

    if (!userId) {
      throw new ApiError(401, 'Unauthorized');
    }

    const user = await userRepository.findById(userId);

    if (!user) {
      throw new ApiError(404, 'User not found');
    }

    return ok(res, serializeUser(user), 'Current user retrieved successfully');
  },
);
