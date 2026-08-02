import { z } from 'zod';

const envelopeSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  errors: z.unknown().nullable().optional(),
});

const fieldErrorsSchema = z.record(z.string(), z.string());

/** A failed API call, normalized out of the backend's response envelope. */
export class ApiError extends Error {
  readonly status: number;
  readonly fieldErrors: Record<string, string>;

  constructor(
    status: number,
    message: string,
    fieldErrors: Record<string, string> = {},
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.fieldErrors = fieldErrors;
  }
}

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
  return new ApiError(
    status,
    parsed.data.message,
    fields.success ? fields.data : {},
  );
};
