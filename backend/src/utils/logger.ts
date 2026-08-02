import pino from 'pino';

import { env } from '../config/env.js';

// Anything that could carry a credential or a token must never reach a log
// sink. Kept in one place so new sinks inherit the same redaction.
const redact = [
  'req.headers.authorization',
  'req.headers.cookie',
  'res.headers["set-cookie"]',
  'password',
  'newPassword',
  'refreshToken',
  'accessToken',
];

export const logger = pino({
  // Silent under test so the suite output stays pristine.
  level: env.NODE_ENV === 'test' ? 'silent' : 'info',
  redact,
  ...(env.NODE_ENV === 'development'
    ? { transport: { target: 'pino-pretty', options: { colorize: true } } }
    : {}),
});
