import { z } from 'zod';

/*
 * Mirrors backend/src/utils/pagination.utils.ts's buildPaginationMeta output.
 * Shared across every paginated list (Students, Staff, Notifications, …) so
 * the Pagination UI component only needs to know this one shape.
 */
export const paginationMetaSchema = z.object({
  totalItems: z.number(),
  itemCount: z.number(),
  itemsPerPage: z.number(),
  totalPages: z.number(),
  currentPage: z.number(),
});

export type PaginationMeta = z.infer<typeof paginationMetaSchema>;
