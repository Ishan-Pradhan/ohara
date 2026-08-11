import { z } from 'zod';

const envelopeSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  errors: z.unknown().nullable().optional(),
});

const fieldErrorsSchema = z.record(z.string(), z.string());

/** Structured "what's blocking this delete" payload from the backend's 409.
 * See backend/src/types/deleteBlockers.types.ts. */
const blockersSchema = z.array(
  z.object({
    entity: z.string(),
    label: z.string(),
    singular: z.string(),
    count: z.number(),
    hint: z.string(),
    category: z.enum(['academic_record', 'ownership']),
  }),
);

/** A failed API call, normalized out of the backend's response envelope. */
export class ApiError extends Error {
  readonly status: number;
  readonly fieldErrors: Record<string, string>;
  readonly blockers: DeleteBlocker[];

  constructor(
    status: number,
    message: string,
    fieldErrors: Record<string, string> = {},
    blockers: DeleteBlocker[] = [],
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.fieldErrors = fieldErrors;
    this.blockers = blockers;
  }
}

interface DeleteBlocker {
  entity: string;
  label: string;
  singular: string;
  count: number;
  hint: string;
  category: 'academic_record' | 'ownership';
}
export type { DeleteBlocker };

/**
 * Turns an arbitrary error body into an ApiError. The backend answers with
 * {success, message, data, errors}; anything that does not match that shape
 * (a proxy error page, a network failure) gets a generic message rather than
 * leaking internals to the user.
 */
export const toApiError = (status: number, body: unknown): ApiError => {
  const parsed = envelopeSchema.safeParse(body);
  if (!parsed.success) {
    return new ApiError(status, 'Something went wrong. Please try again.');
  }

  const fields = fieldErrorsSchema.safeParse(parsed.data.errors);
  const blockers = blockersSchema.safeParse(parsed.data.errors);
  return new ApiError(
    status,
    parsed.data.message,
    fields.success ? fields.data : {},
    blockers.success ? blockers.data : [],
  );
};
