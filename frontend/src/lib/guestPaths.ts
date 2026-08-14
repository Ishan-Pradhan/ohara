/**
 * The guest-only auth pages — must stay in sync with the `guestRoute(...)`
 * calls in routes.tsx. Used by App.tsx to recognize when the session-check
 * (`GET /auth/current-user`) 401ing is the expected, harmless outcome of a
 * visitor who was never logged in, not an actual logout — so it can skip
 * the global redirect-to-/login that would otherwise fire on every guest
 * page load and strip query params like /reset-password's `?token=`.
 */
export const GUEST_PATHS = ['/login', '/register', '/forgot-password', '/reset-password'] as const;

export const isGuestOnlyPath = (pathname: string): boolean =>
  (GUEST_PATHS as readonly string[]).includes(pathname);
