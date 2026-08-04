import { z } from 'zod';

import { api } from '../../lib/axios.js';
import {
  adminUserSchema,
  batchInviteResultSchema,
  paginationMetaSchema,
  teacherSchema,
  type AdminUser,
  type BatchInviteResult,
  type CreateStaffInput,
  type InviteUsersBatchInput,
  type PaginationMeta,
  type Teacher,
} from './users.schema.js';

/** Teachers, for assignment pickers (section class teacher, course teachers).
 * Small institutions won't have enough teachers to need pagination here. */
export const fetchTeachers = async (): Promise<Teacher[]> => {
  const res = await api.get('/admin/users', { params: { role: 'teacher', limit: 100 } });
  return z.array(teacherSchema).parse(res.data.data.items);
};

export interface FetchUsersParams {
  role?: AdminUser['role'];
  search?: string;
  page?: number;
  limit?: number;
}

export interface FetchUsersResult {
  items: AdminUser[];
  meta: PaginationMeta;
}

const usersResultSchema = z.object({
  items: z.array(adminUserSchema),
  meta: paginationMetaSchema,
});

export const fetchUsers = async (params: FetchUsersParams): Promise<FetchUsersResult> => {
  const res = await api.get('/admin/users', { params });
  return usersResultSchema.parse(res.data.data);
};

export const createStaff = async (input: CreateStaffInput): Promise<AdminUser> => {
  const res = await api.post('/admin/users', input);
  return adminUserSchema.parse(res.data.data);
};

export const inviteUsersBatch = async (
  input: InviteUsersBatchInput,
): Promise<BatchInviteResult> => {
  const res = await api.post('/admin/users/batch', input);
  return batchInviteResultSchema.parse(res.data.data);
};
