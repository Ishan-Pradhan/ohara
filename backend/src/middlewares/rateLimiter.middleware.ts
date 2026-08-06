import rateLimit from 'express-rate-limit';

import { env } from '../config/env.js';

export const limiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX,

  standardHeaders: true,
  legacyHeaders: false,

  skip: (req) => req.path === '/health',

  handler: (_req, res) => {
    return res.status(429).json({
      success: false,
      message: 'Too many requests, please try again later.',
      data: null,
      errors: null,
    });
  },
});

// Credential and token endpoints (login, register, refresh, OAuth, password
// reset) sit behind a much tighter limiter than the rest of the API — see
// NFR-3 in docs/REQUIREMENTS.md. Skipped under test so the integration suite,
// which exercises these routes dozens of times per run, doesn't trip it.
export const authLimiter = rateLimit({
  windowMs: env.AUTH_RATE_LIMIT_WINDOW_MS,
  max: env.AUTH_RATE_LIMIT_MAX,

  standardHeaders: true,
  legacyHeaders: false,

  skip: () => env.NODE_ENV === 'test',

  handler: (_req, res) => {
    return res.status(429).json({
      success: false,
      message: 'Too many auth attempts, please try again later.',
      data: null,
      errors: null,
    });
  },
});

// Stricter limiter for tutor messages (NFR-3): each request costs a real
// embedding call + LLM call. Skipped under test for the same reason
// authLimiter is.
export const tutorLimiter = rateLimit({
  windowMs: env.TUTOR_RATE_LIMIT_WINDOW_MS,
  max: env.TUTOR_RATE_LIMIT_MAX,

  standardHeaders: true,
  legacyHeaders: false,

  skip: () => env.NODE_ENV === 'test',

  handler: (_req, res) => {
    return res.status(429).json({
      success: false,
      message: 'Too many tutor messages, please try again in a while.',
      data: null,
      errors: null,
    });
  },
});

// Stricter limiter for AI grading (NFR-3/NFR-8): each submission graded is a
// real LLM call. Applies to both the single-submission and grade-all routes.
// Skipped under test, same as the other LLM-backed limiters.
export const assignmentGradingLimiter = rateLimit({
  windowMs: env.GRADING_RATE_LIMIT_WINDOW_MS,
  max: env.GRADING_RATE_LIMIT_MAX,

  standardHeaders: true,
  legacyHeaders: false,

  skip: () => env.NODE_ENV === 'test',

  handler: (_req, res) => {
    return res.status(429).json({
      success: false,
      message: 'Too many grading requests, please try again in a while.',
      data: null,
      errors: null,
    });
  },
});
