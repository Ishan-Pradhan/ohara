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

// authLimiter is applied per-route, not via router.use() — /current-user and
// /logout are called routinely (every session check, on a 30s staleTime) and
// are already JWT-gated, so they're not a credential-guessing target. Lumping
// them in with login/register under the same 20-req/15min budget meant normal
// multi-tab usage could lock an already-authenticated user out of the whole
// /auth router. See NFR-3 in docs/REQUIREMENTS.md — the intent is a stricter
// limiter on credential/token endpoints, not on every route under /auth.

// ─────────────────────────────────────────────────────────────
// AUTH
// ─────────────────────────────────────────────────────────────

router.route('/register').post(authLimiter, validate(registerSchema), registerUser);

router.route('/login').post(authLimiter, validate(loginSchema), loginUser);

router.route('/logout').post(verifyJWT, logoutUser);

router.route('/current-user').get(verifyJWT, getCurrentUser);

router
  .route('/refresh-access-token')
  .post(authLimiter, validate(refreshAccessTokenSchema), refreshAccessToken);

// ─────────────────────────────────────────────────────────────
// EMAIL VERIFICATION
// ─────────────────────────────────────────────────────────────

router.route('/verify-email').get(authLimiter, validate(verifyEmailSchema), verifyEmail);

router
  .route('/resend-verification-email')
  .post(authLimiter, validate(resendVerificationEmailSchema), resendVerificationEmail);

// ─────────────────────────────────────────────────────────────
// PASSWORD
// ─────────────────────────────────────────────────────────────

router
  .route('/forgot-password')
  .post(authLimiter, validate(forgotPasswordSchema), forgotPassword);

router
  .route('/reset-password')
  .post(authLimiter, validate(resetPasswordSchema), resetPassword);

router
  .route('/change-password')
  .post(authLimiter, verifyJWT, validate(changePasswordSchema), changePassword);

// ─────────────────────────────────────────────────────────────
// OAUTH
// ─────────────────────────────────────────────────────────────

router.route('/google').get(authLimiter, googleAuthRedirect);

router.route('/google/callback').get(authLimiter, googleAuthCallback);

router.route('/github').get(authLimiter, githubAuthRedirect);

router.route('/github/callback').get(authLimiter, githubAuthCallback);

// Aliases (in case Google Console redirect URI uses /oauth/google/*)
router.route('/oauth/google').get(authLimiter, googleAuthRedirect);
router.route('/oauth/google/callback').get(authLimiter, googleAuthCallback);
router.route('/oauth/github').get(authLimiter, githubAuthRedirect);
router.route('/oauth/github/callback').get(authLimiter, githubAuthCallback);

export default router;
