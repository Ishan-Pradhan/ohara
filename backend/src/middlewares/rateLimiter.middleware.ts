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
