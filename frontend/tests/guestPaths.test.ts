import { describe, it, expect } from 'vitest';

import { isGuestOnlyPath } from '../src/lib/guestPaths.js';

describe('isGuestOnlyPath', () => {
  it('recognizes every guest-only auth page', () => {
    expect(isGuestOnlyPath('/login')).toBe(true);
    expect(isGuestOnlyPath('/register')).toBe(true);
    expect(isGuestOnlyPath('/forgot-password')).toBe(true);
    expect(isGuestOnlyPath('/reset-password')).toBe(true);
  });

  it('rejects protected and other non-guest paths', () => {
    expect(isGuestOnlyPath('/')).toBe(false);
    expect(isGuestOnlyPath('/admin/students')).toBe(false);
    expect(isGuestOnlyPath('/verify-email')).toBe(false);
  });
});
