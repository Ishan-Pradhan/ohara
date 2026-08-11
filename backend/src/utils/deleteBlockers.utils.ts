import { ApiError } from './ApiError.js';
import type { DeleteBlocker } from '../types/deleteBlockers.types.js';

/**
 * Throws a structured 409 when `blockers` is non-empty, turning the generic
 * "still referenced" FK failure into an actionable breakdown. The `errors`
 * payload carries the raw blocker objects so the frontend can render a list;
 * the message is a readable one-liner.
 */
export const assertDeletable = (entityLabel: string, blockers: DeleteBlocker[]): void => {
  if (blockers.length === 0) return;

  const list = blockers
    .map((b) => `${b.count} ${b.count === 1 ? b.singular : b.label}`)
    .join(', ');
  const firstHint = blockers[0]?.hint ?? '';

  throw new ApiError(
    409,
    `Cannot delete this ${entityLabel}: it is still referenced by ${list}. ${firstHint}`,
    blockers,
  );
};