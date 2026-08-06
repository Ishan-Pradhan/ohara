import { registry, z } from './registry.js';

/**
 * The DTO shape produced by serializers/user.serializer.ts. If you change one,
 * change the other - this schema is what the API documents as its contract.
 */
export const userPublicSchema = registry.register(
  'UserPublic',
  z.object({
    id: z.uuid(),
    name: z.string(),
    email: z.email(),
    avatarUrl: z.string().nullable(),
    role: z.enum(['admin', 'teacher', 'student', 'alumni']),
    status: z.enum(['active', 'inactive', 'graduated', 'archived']),
    isVerified: z.boolean(),
    isBlocked: z.boolean(),
    authProvider: z.enum(['local', 'google', 'github']),
    dateOfBirth: z.iso.date().nullable(),
    createdAt: z.iso.datetime(),
  }),
);

/** Wraps a payload in the {success, message, data, errors} response envelope. */
export const envelope = <T extends z.ZodType>(data: T) =>
  z.object({
    success: z.boolean(),
    message: z.string(),
    data,
    errors: z.unknown().nullable(),
  });
