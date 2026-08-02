import { Router } from 'express';
import { getCurrentUser } from '../controllers/users.controller.js';
import { validate } from '../middlewares/validate.middleware.js';
import { authLimiter } from '../middlewares/rateLimiter.middleware.js';
import {
  loginSchema,
  refreshAccessTokenSchema,
  registerSchema,
  resendVerificationEmailSchema,
  verifyEmailSchema,
} from '../validations/auth.validation.js';
import {
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
} from '../validations/auth.validation.js';
import { verifyJWT } from '../middlewares/auth.middleware.js';
import {
  registerUser,
  loginUser,
  logoutUser,
  refreshAccessToken,
  forgotPassword,
  resetPassword,
  changePassword,
} from '../controllers/auth.controller.js';
import {
  githubAuthCallback,
  githubAuthRedirect,
  googleAuthCallback,
  googleAuthRedirect,
} from '../controllers/oauth.controller.js';
import {
  resendVerificationEmail,
  verifyEmail,
} from '../controllers/verifications.controller.js';

const router = Router();

router.use(authLimiter);

// ─────────────────────────────────────────────────────────────
// AUTH
// ─────────────────────────────────────────────────────────────

router.route('/register').post(validate(registerSchema), registerUser);

router.route('/login').post(validate(loginSchema), loginUser);

router.route('/logout').post(verifyJWT, logoutUser);

router.route('/current-user').get(verifyJWT, getCurrentUser);

router
  .route('/refresh-access-token')
  .post(validate(refreshAccessTokenSchema), refreshAccessToken);

// ─────────────────────────────────────────────────────────────
// EMAIL VERIFICATION
// ─────────────────────────────────────────────────────────────

router.route('/verify-email').get(validate(verifyEmailSchema), verifyEmail);

router
  .route('/resend-verification-email')
  .post(validate(resendVerificationEmailSchema), resendVerificationEmail);

// ─────────────────────────────────────────────────────────────
// PASSWORD
// ─────────────────────────────────────────────────────────────

router
  .route('/forgot-password')
  .post(validate(forgotPasswordSchema), forgotPassword);

router
  .route('/reset-password')
  .post(validate(resetPasswordSchema), resetPassword);

router
  .route('/change-password')
  .post(verifyJWT, validate(changePasswordSchema), changePassword);

// ─────────────────────────────────────────────────────────────
// OAUTH
// ─────────────────────────────────────────────────────────────

router.route('/google').get(googleAuthRedirect);

router.route('/google/callback').get(googleAuthCallback);

router.route('/github').get(githubAuthRedirect);

router.route('/github/callback').get(githubAuthCallback);

// Aliases (in case Google Console redirect URI uses /oauth/google/*)
router.route('/oauth/google').get(googleAuthRedirect);
router.route('/oauth/google/callback').get(googleAuthCallback);
router.route('/oauth/github').get(githubAuthRedirect);
router.route('/oauth/github/callback').get(githubAuthCallback);

export default router;
