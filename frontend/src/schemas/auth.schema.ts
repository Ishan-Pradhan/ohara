import { z } from 'zod';

/*
 * These mirror backend/src/validations/auth.validation.ts. The duplication is
 * deliberate: there is no shared workspace package, and duplicating ~30 lines
 * was judged cheaper than reintroducing a monorepo layout. If the backend rules
 * change, change them here too.
 */

export const loginSchema = z.object({
  email: z.email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const registerSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.email('Enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

export const forgotPasswordSchema = z.object({
  email: z.email('Enter a valid email address'),
});

export const resetPasswordSchema = z.object({
  newPassword: z.string().min(6, 'New password must be at least 6 characters'),
});

/*
 * Mirrors the UserPublic schema the API documents. `status` is omitted on
 * purpose: the backend refuses to authenticate a non-active account, so any
 * user the frontend can observe is active.
 */
export const currentUserSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  avatarUrl: z.string().nullable(),
  role: z.enum(['admin', 'teacher', 'student', 'alumni']),
  isVerified: z.boolean(),
  isBlocked: z.boolean(),
  authProvider: z.enum(['local', 'google', 'github']),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type CurrentUser = z.infer<typeof currentUserSchema>;
