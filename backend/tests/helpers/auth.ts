import { vi } from 'vitest';
import type { Response } from 'supertest';

/**
 * Stub for the Resend-backed email service, so tests make no network calls.
 * Exported as a factory rather than a vi.mock() call: Vitest hoists vi.mock
 * only within the file it is written in, so each test file must declare its
 * own vi.mock and pull the stub in through an async factory.
 */
export const emailServiceStub = () => ({
  sendVerificationEmail: vi.fn(async () => ({
    verifyLink: 'http://test/verify',
  })),
  sendPasswordResetEmail: vi.fn(async () => ({
    resetLink: 'http://test/reset',
  })),
  sendStaffInviteEmail: vi.fn(async () => ({
    setPasswordLink: 'http://test/reset',
  })),
});

export const cookiesFrom = (res: Response): string[] => {
  const raw = res.headers['set-cookie'];
  return Array.isArray(raw) ? raw : raw ? [raw] : [];
};
