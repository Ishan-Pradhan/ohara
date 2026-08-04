import { z } from 'zod';

export const teacherSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
});

export const adminUserSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  role: z.enum(['admin', 'teacher', 'student', 'alumni']),
  status: z.enum(['active', 'inactive', 'graduated', 'archived']),
  isVerified: z.boolean(),
  isBlocked: z.boolean(),
  avatarUrl: z.string().nullable(),
  createdAt: z.string(),
});

export const createStaffSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email'),
  role: z.enum(['teacher', 'admin']),
});

export const inviteUsersBatchSchema = z.object({
  role: z.enum(['teacher', 'admin', 'student']),
  users: z
    .array(z.object({ name: z.string().min(1), email: z.string().email() }))
    .min(1)
    .max(200),
});

export const batchInviteResultSchema = z.object({
  invited: z.array(adminUserSchema),
  skipped: z.array(z.object({ email: z.string(), reason: z.string() })),
});

export const paginationMetaSchema = z.object({
  totalItems: z.number(),
  itemCount: z.number(),
  itemsPerPage: z.number(),
  totalPages: z.number(),
  currentPage: z.number(),
});

export type Teacher = z.infer<typeof teacherSchema>;
export type AdminUser = z.infer<typeof adminUserSchema>;
export type PaginationMeta = z.infer<typeof paginationMetaSchema>;
export type CreateStaffInput = z.infer<typeof createStaffSchema>;
export type InviteUsersBatchInput = z.infer<typeof inviteUsersBatchSchema>;
export type BatchInviteResult = z.infer<typeof batchInviteResultSchema>;
