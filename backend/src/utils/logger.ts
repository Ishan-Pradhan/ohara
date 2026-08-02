import pino, { type LoggerOptions } from 'pino';

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

const options: LoggerOptions = {
  // Silent under test so the suite output stays pristine.
  level: env.NODE_ENV === 'test' ? 'silent' : 'info',
  redact,
};

/**
 * pino-pretty is a devDependency, so it is absent from the production image
 * (built with `npm ci --omit=dev`). Requesting it there throws at startup and
 * crash-loops the container, so fall back to plain JSON rather than assuming
 * NODE_ENV alone tells us whether the module exists.
 */
const buildLogger = () => {
  if (env.NODE_ENV !== 'development') return pino(options);

  try {
    return pino({
      ...options,
      transport: { target: 'pino-pretty', options: { colorize: true } },
    });
  } catch {
    return pino(options);
  }
};

export const logger = buildLogger();
