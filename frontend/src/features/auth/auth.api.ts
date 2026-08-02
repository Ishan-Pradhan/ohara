import { api } from '../../lib/axios.js';
import {
  currentUserSchema,
  type CurrentUser,
  type LoginInput,
  type RegisterInput,
} from '../../schemas/auth.schema.js';

/**
 * Parsing at the boundary means backend contract drift surfaces here, with a
 * clear message, rather than as an undefined three components deeper.
 */
export const fetchCurrentUser = async (): Promise<CurrentUser> => {
  const res = await api.get('/auth/current-user');
  return currentUserSchema.parse(res.data.data);
};

export const login = async (input: LoginInput): Promise<void> => {
  await api.post('/auth/login', input);
};

export const register = async (input: RegisterInput): Promise<void> => {
  await api.post('/auth/register', input);
};

export const logout = async (): Promise<void> => {
  await api.post('/auth/logout');
};

export const verifyEmail = async (token: string): Promise<void> => {
  await api.get('/auth/verify-email', { params: { token } });
};
