import { describe, it, expect } from 'vitest';
import { serializeUser } from '../../src/serializers/user.serializer.js';
import { User } from '../../src/models/users.model.js';

describe('serializeUser', () => {
  const build = () =>
    User.build({
      id: '11111111-1111-1111-1111-111111111111',
      name: 'Jane Doe',
      email: 'jane@example.com',
      password: 'super-secret-hash',
      refreshToken: 'a-refresh-token',
      role: 'admin',
      isVerified: true,
      isBlocked: false,
      authProvider: 'local',
      avatarUrl: null,
    });

  it('never leaks the password hash', () => {
    expect(serializeUser(build())).not.toHaveProperty('password');
  });

  it('never leaks the refresh token', () => {
    expect(serializeUser(build())).not.toHaveProperty('refreshToken');
  });

  it('exposes the public fields', () => {
    const dto = serializeUser(build());
    expect(dto.id).toBe('11111111-1111-1111-1111-111111111111');
    expect(dto.email).toBe('jane@example.com');
    expect(dto.role).toBe('admin');
  });
});
