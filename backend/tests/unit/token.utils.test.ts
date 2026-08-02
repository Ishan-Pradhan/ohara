import { describe, it, expect } from 'vitest';
import jwt from 'jsonwebtoken';
import { env } from '../../src/config/env.js';

describe('access token signing', () => {
  it('round-trips the user id and email', () => {
    const token = jwt.sign(
      { id: 'user-1', email: 'jane@example.com' },
      env.ACCESS_TOKEN_SECRET,
      { expiresIn: '15m' },
    );

    const decoded = jwt.verify(token, env.ACCESS_TOKEN_SECRET) as {
      id: string;
      email: string;
    };

    expect(decoded.id).toBe('user-1');
    expect(decoded.email).toBe('jane@example.com');
  });

  it('rejects a token signed with the wrong secret', () => {
    const token = jwt.sign({ id: 'user-1' }, 'a'.repeat(32));
    expect(() => jwt.verify(token, env.ACCESS_TOKEN_SECRET)).toThrow();
  });

  it('rejects an already-expired token', () => {
    const token = jwt.sign({ id: 'user-1' }, env.ACCESS_TOKEN_SECRET, {
      expiresIn: '-1s',
    });
    expect(() => jwt.verify(token, env.ACCESS_TOKEN_SECRET)).toThrow(
      jwt.TokenExpiredError,
    );
  });
});
