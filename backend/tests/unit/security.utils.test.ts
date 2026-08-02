import { describe, it, expect } from 'vitest';
import {
  hashPassword,
  comparePassword,
  generateToken,
} from '../../src/utils/security.utils.js';

describe('password hashing', () => {
  it('does not store the plaintext', async () => {
    const hash = await hashPassword('hunter2secret');
    expect(hash).not.toBe('hunter2secret');
    expect(hash.startsWith('$2')).toBe(true);
  });

  it('accepts the correct password', async () => {
    const hash = await hashPassword('hunter2secret');
    await expect(comparePassword('hunter2secret', hash)).resolves.toBe(true);
  });

  it('rejects the wrong password', async () => {
    const hash = await hashPassword('hunter2secret');
    await expect(comparePassword('wrong-password', hash)).resolves.toBe(false);
  });

  it('salts — two hashes of the same input differ', async () => {
    const [a, b] = await Promise.all([
      hashPassword('hunter2secret'),
      hashPassword('hunter2secret'),
    ]);
    expect(a).not.toBe(b);
  });
});

describe('generateToken', () => {
  it('returns 64 hex characters', () => {
    expect(generateToken()).toMatch(/^[0-9a-f]{64}$/);
  });

  it('does not repeat', () => {
    const tokens = new Set(Array.from({ length: 50 }, () => generateToken()));
    expect(tokens.size).toBe(50);
  });
});
