export interface RegisterUserTypes {
  name: string;
  email: string;
  password: string;
  dateOfBirth?: string;
}

export interface LoginUserTypes {
  email: string;
  password: string;
}

export interface JwtPayload {
  id: string;
  email: string;
}

import type { Request } from 'express';
import type { User } from '../models/users.model.js';
export interface AuthRequest extends Request {
  user?: User;
}
