import {
  getAccessTokenCookieOptions,
  getRefreshTokenCookieOptions,
} from '../config/cookie.config.js';
import { env } from '../config/env.js';
import {
  ONE_HOUR_IN_MS,
  TWENTY_FOUR_HOURS_IN_MS,
  USER_ROLES,
  USER_STATUS,
} from '../constants/index.js';
import { userRepository } from '../repositories/users.repository.js';
import { verificationRepository } from '../repositories/verification.repository.js';
import { institutionProfileRepository } from '../repositories/institutionProfile.repository.js';
import {
  sendPasswordResetEmail,
  sendVerificationEmail,
} from '../services/email.service.js';
import type {
  AuthRequest,
  LoginUserTypes,
  RegisterUserTypes,
} from '../types/auth.types.js';
import { serializeUser } from '../serializers/user.serializer.js';
import { logger } from '../utils/logger.js';
import { ApiError } from '../utils/ApiError.js';
import { ok } from '../utils/ApiResponse.js';
import { asyncHandler } from '../utils/AsyncHandler.js';
import { getGravatar } from '../utils/gravatar.utils.js';
import {
  comparePassword,
  generateToken,
  hashPassword,
} from '../utils/security.utils.js';
import { generateAccessAndRefereshTokens } from '../utils/token.utils.js';
import type { Request, Response } from 'express';
import jwt, { type JwtPayload } from 'jsonwebtoken';

// REGISTER
export const registerUser = asyncHandler(
  async (req: Request, res: Response) => {
    const { name, email, password } = req.validated?.body as RegisterUserTypes;

    const existingUser = await userRepository.findByEmail(email);
    if (existingUser) {
      throw new ApiError(400, 'Email already exists');
    }

    const hashedPassword = await hashPassword(password);

    const userCount = await userRepository.count();
    // The first account to register bootstraps the institution as its admin.
    // Everyone else self-registers as a student; teachers and admins are
    // provisioned by an admin (REQUIREMENTS.md FR-1a, admin.controller.ts createStaff).
    const role = userCount === 0 ? USER_ROLES.ADMIN : USER_ROLES.STUDENT;

    // Student self-registration can be closed entirely, or scoped to the
    // institution's own email domain (REQUIREMENTS.md FR-1c/FR-1d) — the
    // bootstrap admin above is exempt, since nobody has configured anything yet.
    if (role === USER_ROLES.STUDENT) {
      const profile = await institutionProfileRepository.get();
      if (profile && !profile.selfRegistrationEnabled) {
        throw new ApiError(
          403,
          'Self-registration is closed. Ask your administrator for an invite.',
        );
      }
      if (profile?.allowedEmailDomain) {
        const emailDomain = email.split('@')[1]?.toLowerCase();
        if (emailDomain !== profile.allowedEmailDomain) {
          throw new ApiError(
            400,
            `Registration is limited to @${profile.allowedEmailDomain} email addresses`,
          );
        }
      }
    }

    const newUser = await userRepository.create({
      name,
      email,
      password: hashedPassword,
      avatarUrl: getGravatar(email),
      role,
    });

    const verificationToken = generateToken();
    const expiresAt = new Date(Date.now() + TWENTY_FOUR_HOURS_IN_MS);
    await verificationRepository.deleteEmailVerificationsForUser(newUser.id);
    await verificationRepository.createEmailVerification(
      newUser.id,
      verificationToken,
      expiresAt,
    );

    let verificationEmailSent = false;
    let verifyLink: string | undefined;

    try {
      const result = await sendVerificationEmail(
        newUser.email,
        verificationToken,
      );
      verificationEmailSent = true;
      verifyLink = result.verifyLink;
    } catch (emailError) {
      logger.error({ err: emailError }, 'Failed to send verification email');
    }

    const { accessToken, refreshToken } = await generateAccessAndRefereshTokens(
      newUser.id,
    );

    return res
      .status(201)
      .cookie('accessToken', accessToken, getAccessTokenCookieOptions())
      .cookie('refreshToken', refreshToken, getRefreshTokenCookieOptions())
      .json({
        success: true,
        data: {
          id: newUser.id,
          name: newUser.name,
          email: newUser.email,
          avatarUrl: newUser.avatarUrl,
          verificationEmailSent,
          ...(env.NODE_ENV === 'development' && verifyLink
            ? { verifyLink }
            : {}),
        },
        message: verificationEmailSent
          ? 'User registered successfully. Verification email sent.'
          : 'User registered successfully. Verification email could not be sent.',
      });
  },
);

// LOGIN
export const loginUser = asyncHandler(
  async (req: Request, res: Response): Promise<Response> => {
    const { email, password } = req.validated?.body as LoginUserTypes;

    const user = await userRepository.findByEmailWithPassword(email);

    if (!user) {
      throw new ApiError(400, 'Invalid email or password');
    }

    if (user.isBlocked) {
      throw new ApiError(403, 'Your account has been blocked');
    }

    // Graduated / archived / deactivated accounts keep their academic record
    // but lose access (golden rule 10).
    if (user.status !== USER_STATUS.ACTIVE) {
      throw new ApiError(
        403,
        'This account is no longer active. Please contact your administrator.',
      );
    }

    if (!user.isVerified) {
      throw new ApiError(
        403,
        'Your account is not verified. Please verify your email',
      );
    }

    if (user.authProvider === 'google') {
      throw new ApiError(
        400,
        'You previously signed in with Google. Please use Google login.',
      );
    }

    const isPasswordValid = await comparePassword(password, user.password);

    if (!isPasswordValid) {
      throw new ApiError(401, 'Invalid user credentials');
    }

    if (!user.avatarUrl) {
      user.avatarUrl = getGravatar(user.email);
      await user.save();
    }

    const { accessToken, refreshToken } = await generateAccessAndRefereshTokens(
      user.id,
    );

    return res
      .status(200)
      .cookie('accessToken', accessToken, getAccessTokenCookieOptions())
      .cookie('refreshToken', refreshToken, getRefreshTokenCookieOptions())
      .json({
        success: true,
        data: {
          id: user.id,
          name: user.name,
          email: user.email,
          avatarUrl: user.avatarUrl,
        },
        message: 'Login Successful',
      });
  },
);

// LOGOUT
export const logoutUser = asyncHandler(
  async (req: Request, res: Response): Promise<Response> => {
    const accessToken = req.cookies.accessToken;

    if (accessToken) {
      try {
        const decoded = jwt.verify(
          accessToken,
          env.ACCESS_TOKEN_SECRET,
        ) as { id: string };

        const user = await userRepository.findByIdWithSecrets(decoded.id);

        if (user) {
          user.refreshToken = null;
          await user.save();
        }
      } catch {
        // Best-effort: an invalid or expired token still clears the cookies below.
      }
    }

    return res
      .clearCookie('accessToken', getAccessTokenCookieOptions())
      .clearCookie('refreshToken', getRefreshTokenCookieOptions())
      .json({
        success: true,
        message: 'Logged out successfully',
      });
  },
);

// REFRESH ACCESS TOKEN
export const refreshAccessToken = asyncHandler(
  async (req: Request, res: Response): Promise<Response> => {
    const refreshToken = req.cookies.refreshToken;

    if (!refreshToken) {
      throw new ApiError(401, 'Unauthorized: No refresh token provided');
    }
    let decoded: JwtPayload & { id: string };

    try {
      decoded = jwt.verify(
        refreshToken,
        env.REFRESH_TOKEN_SECRET,
      ) as JwtPayload & { id: string };
    } catch {
      throw new ApiError(401, 'Unauthorized: Invalid refresh token');
    }

    const user = await userRepository.findByIdWithSecrets(decoded.id);

    if (!user || user.refreshToken !== refreshToken) {
      throw new ApiError(401, 'Unauthorized: Invalid refresh token');
    }

    const { accessToken, refreshToken: newRefreshToken } =
      await generateAccessAndRefereshTokens(user.id);

    return res
      .status(200)
      .cookie('accessToken', accessToken, getAccessTokenCookieOptions())
      .cookie('refreshToken', newRefreshToken, getRefreshTokenCookieOptions())
      .json({
        success: true,
        // Must go through the serializer: this user came from the unscoped
        // query, so it still carries the password hash and refresh token.
        data: serializeUser(user),
        message: 'Token refreshed successfully',
      });
  },
);

// CHANGE PASSWORD (AUTHENTICATED)
export const changePassword = asyncHandler(
  async (req: AuthRequest, res: Response): Promise<Response> => {
    const userId = req.user?.id;

    if (!userId) {
      throw new ApiError(401, 'Unauthorized');
    }

    const { currentPassword, newPassword } = req.validated?.body as {
      currentPassword: string;
      newPassword: string;
    };

    const user = await userRepository.findByIdWithSecrets(userId);

    if (!user) {
      throw new ApiError(404, 'User not found');
    }

    const isMatch = await comparePassword(currentPassword, user.password);

    if (!isMatch) {
      throw new ApiError(400, 'Current password is incorrect');
    }

    user.password = await hashPassword(newPassword);
    await user.save();

    return ok(res, null, 'Password changed successfully');
  },
);

// FORGOT PASSWORD (PUBLIC)
export const forgotPassword = asyncHandler(
  async (req: Request, res: Response): Promise<Response> => {
    const { email } = req.validated?.body as { email: string };

    const user = await userRepository.findByEmail(email);

    if (!user || user.authProvider === 'google') {
      return ok(res, null, 'If the account exists, a reset link was sent.');
    }

    const resetToken = generateToken();
    const expiresAt = new Date(Date.now() + ONE_HOUR_IN_MS);

    await verificationRepository.deletePasswordResetTokensForUser(user.id);
    await verificationRepository.createPasswordResetToken(
      user.id,
      resetToken,
      expiresAt,
    );

    try {
      await sendPasswordResetEmail(user.email, resetToken);
    } catch (emailErr) {
      logger.error({ err: emailErr }, 'Failed to send password reset email');
    }

    return ok(
      res,
      null,
      'If an account exists for this email, a password reset link has been sent.',
    );
  },
);

// RESET PASSWORD (PUBLIC)
export const resetPassword = asyncHandler(
  async (req: Request, res: Response): Promise<Response> => {
    const { token, newPassword } = req.validated?.body as {
      token: string;
      newPassword: string;
    };

    const record = await verificationRepository.findPasswordResetByToken(token);

    if (!record) {
      throw new ApiError(400, 'Invalid or expired reset token');
    }

    if (new Date(record.expiresAt).getTime() < Date.now()) {
      await verificationRepository.deleteById(record.id);
      throw new ApiError(400, 'Reset token has expired');
    }

    const user = await userRepository.findById(record.userId);

    if (!user) {
      await verificationRepository.deleteById(record.id);
      throw new ApiError(404, 'User not found');
    }

    user.password = await hashPassword(newPassword);
    // No-op for an already-verified user resetting their password; this is
    // also how an admin-invited teacher/admin account (created unverified,
    // see admin.controller.ts createStaff) activates itself.
    user.isVerified = true;
    await user.save();

    await verificationRepository.deletePasswordResetTokensForUser(user.id);

    return ok(res, null, 'Password has been reset');
  },
);
