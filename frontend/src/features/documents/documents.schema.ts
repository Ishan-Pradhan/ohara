import { z } from 'zod';

export const documentSchema = z.object({
  id: z.string(),
  courseId: z.string(),
  uploadedBy: z.string(),
  filename: z.string(),
  status: z.enum(['processing', 'ready', 'failed']),
  errorMessage: z.string().nullable(),
  createdAt: z.string(),
});

export type Document = z.infer<typeof documentSchema>;
