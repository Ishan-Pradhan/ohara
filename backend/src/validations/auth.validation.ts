import { z } from './registry.js';

export const registerSchema = {
  body: z.object({
    name: z.string().min(1, 'Name is required'),
    email: z.email('Invalid email'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
  }),
};

export const loginSchema = {
  body: z.object({
    email: z.email('Invalid email'),
    password: z.string().min(1, 'Password is required'),
  }),
};

export const verifyEmailSchema = {
  query: z.object({
    token: z.string().min(1, 'Verification token is required'),
  }),
};

export const resendVerificationEmailSchema = {
  body: z.object({
    email: z.email('Invalid email'),
  }),
};

export const forgotPasswordSchema = {
  body: z.object({
    email: z.email('Invalid email'),
  }),
};

export const resetPasswordSchema = {
  body: z.object({
    token: z.string().min(1, 'Reset token is required'),
    newPassword: z
      .string()
      .min(6, 'New password must be at least 6 characters'),
  }),
};

export const changePasswordSchema = {
  body: z.object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z
      .string()
      .min(6, 'New password must be at least 6 characters'),
  }),
};

export const refreshAccessTokenSchema = {
  cookies: z.object({
    refreshToken: z.string().optional(),
  }),
};

// ── OpenAPI path registrations ─────────────────────────────────────────────
// The schemas above are the single source of truth: they validate the request
// AND document it. Adding a route means adding a registerPath call here.

import { registry } from './registry.js';
import { envelope, userPublicSchema } from './user.response.js';

const jsonBody = (schema: z.ZodType) => ({
  content: { 'application/json': { schema } },
});

const okUser = (description: string) => ({
  description,
  content: { 'application/json': { schema: envelope(userPublicSchema) } },
});

registry.registerPath({
  method: 'post',
  path: '/auth/register',
  tags: ['Auth'],
  security: [],
  request: { body: jsonBody(registerSchema.body) },
  responses: {
    201: okUser('User registered; sets accessToken and refreshToken cookies'),
    400: { description: 'Email already exists or validation failed' },
  },
});

registry.registerPath({
  method: 'post',
  path: '/auth/login',
  tags: ['Auth'],
  security: [],
  request: { body: jsonBody(loginSchema.body) },
  responses: {
    200: okUser('Login successful; sets both auth cookies'),
    401: { description: 'Invalid credentials' },
    403: { description: 'Account unverified, blocked, or not active' },
  },
});

registry.registerPath({
  method: 'get',
  path: '/auth/current-user',
  tags: ['Auth'],
  responses: {
    200: okUser('The authenticated caller'),
    401: { description: 'Not authenticated' },
  },
});

registry.registerPath({
  method: 'post',
  path: '/auth/logout',
  tags: ['Auth'],
  responses: { 200: { description: 'Logged out; clears both cookies' } },
});

registry.registerPath({
  method: 'post',
  path: '/auth/refresh-access-token',
  tags: ['Auth'],
  security: [],
  responses: {
    200: okUser('New token pair issued; rotates the refresh cookie'),
    401: { description: 'Missing or invalid refresh token' },
  },
});

registry.registerPath({
  method: 'get',
  path: '/auth/verify-email',
  tags: ['Email Verification'],
  security: [],
  request: { query: verifyEmailSchema.query },
  responses: {
    200: { description: 'Email verified' },
    400: { description: 'Invalid or expired verification token' },
  },
});

registry.registerPath({
  method: 'post',
  path: '/auth/resend-verification-email',
  tags: ['Email Verification'],
  security: [],
  request: { body: jsonBody(resendVerificationEmailSchema.body) },
  responses: {
    200: { description: 'Verification email sent' },
    400: { description: 'Account already verified' },
  },
});

registry.registerPath({
  method: 'post',
  path: '/auth/forgot-password',
  tags: ['Password'],
  security: [],
  request: { body: jsonBody(forgotPasswordSchema.body) },
  responses: {
    200: {
      description:
        'Always succeeds - does not disclose whether the account exists',
    },
  },
});

registry.registerPath({
  method: 'post',
  path: '/auth/reset-password',
  tags: ['Password'],
  security: [],
  request: { body: jsonBody(resetPasswordSchema.body) },
  responses: {
    200: { description: 'Password reset' },
    400: { description: 'Invalid or expired reset token' },
  },
});

registry.registerPath({
  method: 'post',
  path: '/auth/change-password',
  tags: ['Password'],
  request: { body: jsonBody(changePasswordSchema.body) },
  responses: {
    200: { description: 'Password changed' },
    401: { description: 'Not authenticated or current password wrong' },
  },
});

// OAuth entry points are browser redirects, not JSON APIs: they have no request
// body and answer with a 302, so they are documented for discoverability only.
for (const provider of ['google', 'github'] as const) {
  registry.registerPath({
    method: 'get',
    path: `/auth/${provider}`,
    tags: ['OAuth'],
    security: [],
    responses: {
      302: { description: `Redirects the browser to ${provider} for consent` },
    },
  });

  registry.registerPath({
    method: 'get',
    path: `/auth/${provider}/callback`,
    tags: ['OAuth'],
    security: [],
    responses: {
      302: {
        description:
          'Sets both auth cookies and redirects to FRONTEND_URL, or to /login?error= on failure',
      },
      400: { description: 'Missing OAuth code or invalid state' },
    },
  });
}

registry.registerPath({
  method: 'get',
  path: '/health',
  tags: ['Health'],
  security: [],
  responses: {
    200: {
      description: 'Service liveness, uptime and server timestamp',
      content: {
        'application/json': {
          schema: z.object({
            status: z.literal('ok'),
            uptime: z.number(),
            timestamp: z.number(),
          }),
        },
      },
    },
  },
});
