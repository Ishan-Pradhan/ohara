import type { User } from '../models/users.model.js';

export const serializeUser = (u: User) => ({
  id: u.id,
  name: u.name,
  email: u.email,
  role: u.role,
  status: u.status,
  isVerified: u.isVerified,
  isBlocked: u.isBlocked,
  authProvider: u.authProvider,
  avatarUrl: u.avatarUrl,
  dateOfBirth: u.dateOfBirth,
  createdAt: u.createdAt,
});

/** A thin name/email/status row for a teacher-facing roster — deliberately
 * not the full serializeUser shape (no auth-related fields a teacher has no
 * business seeing). */
export const serializeRosterStudent = (u: User) => ({
  id: u.id,
  name: u.name,
  email: u.email,
  status: u.status,
  avatarUrl: u.avatarUrl,
});
