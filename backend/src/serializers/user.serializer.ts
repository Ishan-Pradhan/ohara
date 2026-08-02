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
  createdAt: u.createdAt,
});
