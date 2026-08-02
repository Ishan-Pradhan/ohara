import type { UserInstance } from '../types/users.types.js';

export const serializeUser = (u: UserInstance) => ({
  id: u.id,
  name: u.name,
  email: u.email,
  role: u.role,
  isVerified: u.isVerified,
  isBlocked: u.isBlocked,
  authProvider: u.authProvider,
  avatarUrl: u.avatarUrl,
  createdAt: u.createdAt,
});
