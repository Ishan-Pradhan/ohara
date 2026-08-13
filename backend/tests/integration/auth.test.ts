import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import request from 'supertest';

vi.mock('../../src/services/email.service.js', async () => {
  const { emailServiceStub } = await import('../helpers/auth.js');
  return emailServiceStub();
});

const { app } = await import('../../src/app.js');
const { truncateAll, closeDb } = await import('../helpers/db.js');
const { cookiesFrom } = await import('../helpers/auth.js');
const { User } = await import('../../src/models/users.model.js');

const REGISTER = '/api/v1/auth/register';
const LOGIN = '/api/v1/auth/login';
const CURRENT = '/api/v1/auth/current-user';
const REFRESH = '/api/v1/auth/refresh-access-token';
const LOGOUT = '/api/v1/auth/logout';
const CHANGE_PASSWORD = '/api/v1/auth/change-password';

const credentials = {
  name: 'Jane Doe',
  email: 'jane@example.com',
  password: 'hunter2secret',
};

/** Registers the user and marks them verified so they can actually log in. */
const registerVerified = async (): Promise<void> => {
  await request(app).post(REGISTER).send(credentials);
  await User.update(
    { isVerified: true },
    { where: { email: credentials.email } },
  );
};

const signIn = async (): Promise<string[]> => {
  const res = await request(app)
    .post(LOGIN)
    .send({ email: credentials.email, password: credentials.password });
  return cookiesFrom(res);
};

beforeEach(async () => {
  await truncateAll();
});

afterAll(async () => {
  await closeDb();
});

describe('POST /auth/register', () => {
  it('creates a user and never returns the password', async () => {
    const res = await request(app).post(REGISTER).send(credentials);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data).not.toHaveProperty('password');
    expect(res.body.data).not.toHaveProperty('refreshToken');
    expect(res.body.data.email).toBe(credentials.email);
  });

  it('sets both auth cookies as httpOnly', async () => {
    const cookies = cookiesFrom(await request(app).post(REGISTER).send(credentials));

    const access = cookies.find((c) => c.startsWith('accessToken='));
    const refresh = cookies.find((c) => c.startsWith('refreshToken='));

    expect(access).toBeDefined();
    expect(refresh).toBeDefined();
    expect(access).toContain('HttpOnly');
    expect(refresh).toContain('HttpOnly');
  });

  it('makes the very first account an admin', async () => {
    await request(app).post(REGISTER).send(credentials);

    const user = await User.findOne({ where: { email: credentials.email } });
    expect(user?.role).toBe('admin');
  });

  it('makes every subsequent account a student', async () => {
    await request(app).post(REGISTER).send(credentials);
    await request(app)
      .post(REGISTER)
      .send({ ...credentials, email: 'second@example.com' });

    const second = await User.findOne({
      where: { email: 'second@example.com' },
    });
    expect(second?.role).toBe('student');
  });

  it('defaults new accounts to active status', async () => {
    await request(app).post(REGISTER).send(credentials);

    const user = await User.findOne({ where: { email: credentials.email } });
    expect(user?.status).toBe('active');
  });

  it('rejects a duplicate email', async () => {
    await request(app).post(REGISTER).send(credentials);
    const res = await request(app).post(REGISTER).send(credentials);

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('rejects a password shorter than six characters', async () => {
    const res = await request(app)
      .post(REGISTER)
      .send({ ...credentials, password: 'abc' });

    expect(res.status).toBe(400);
  });
});

describe('POST /auth/register — student email domain gating', () => {
  const setAllowedDomain = async (domain: string) => {
    const { institutionProfileRepository } = await import(
      '../../src/repositories/institutionProfile.repository.js'
    );
    await institutionProfileRepository.upsert({
      name: 'NCCS College',
      allowedEmailDomain: domain,
    });
  };

  it('bootstraps the first account as admin even with a domain configured for a different email', async () => {
    // No profile exists yet at this point — this is the very first account,
    // so it becomes admin regardless of any domain restriction.
    const res = await request(app).post(REGISTER).send(credentials);
    expect(res.status).toBe(201);

    const { User } = await import('../../src/models/users.model.js');
    const user = await User.findOne({ where: { email: credentials.email } });
    expect(user?.role).toBe('admin');
  });

  it('rejects a student registration with a non-matching email domain', async () => {
    await request(app).post(REGISTER).send(credentials); // bootstrap admin
    await setAllowedDomain('nccs.edu.np');

    const res = await request(app)
      .post(REGISTER)
      .send({ name: 'Outsider', email: 'outsider@gmail.com', password: 'hunter2secret' });

    expect(res.status).toBe(400);
  });

  it('accepts a student registration with a matching email domain', async () => {
    await request(app).post(REGISTER).send(credentials); // bootstrap admin
    await setAllowedDomain('nccs.edu.np');

    const res = await request(app)
      .post(REGISTER)
      .send({ name: 'Student', email: 'student@nccs.edu.np', password: 'hunter2secret' });

    expect(res.status).toBe(201);
  });

  it('matches the domain case-insensitively', async () => {
    await request(app).post(REGISTER).send(credentials); // bootstrap admin
    await setAllowedDomain('nccs.edu.np');

    const res = await request(app)
      .post(REGISTER)
      .send({ name: 'Student', email: 'student@NCCS.EDU.NP', password: 'hunter2secret' });

    expect(res.status).toBe(201);
  });

  it('allows any email domain when none is configured', async () => {
    await request(app).post(REGISTER).send(credentials); // bootstrap admin

    const res = await request(app)
      .post(REGISTER)
      .send({ name: 'Anyone', email: 'anyone@example.org', password: 'hunter2secret' });

    expect(res.status).toBe(201);
  });
});

describe('POST /auth/register — self-registration switch', () => {
  const disableSelfRegistration = async () => {
    const { institutionProfileRepository } = await import(
      '../../src/repositories/institutionProfile.repository.js'
    );
    await institutionProfileRepository.upsert({
      name: 'NCCS College',
      selfRegistrationEnabled: false,
    });
  };

  it('rejects student self-registration with 403 once closed', async () => {
    await request(app).post(REGISTER).send(credentials); // bootstrap admin
    await disableSelfRegistration();

    const res = await request(app)
      .post(REGISTER)
      .send({ name: 'Latecomer', email: 'latecomer@example.com', password: 'hunter2secret' });

    expect(res.status).toBe(403);
  });
});

describe('POST /auth/login', () => {
  it('refuses an unverified account', async () => {
    await request(app).post(REGISTER).send(credentials);

    const res = await request(app)
      .post(LOGIN)
      .send({ email: credentials.email, password: credentials.password });

    expect(res.status).toBe(403);
  });

  it('succeeds once the account is verified', async () => {
    await registerVerified();

    const res = await request(app)
      .post(LOGIN)
      .send({ email: credentials.email, password: credentials.password });

    expect(res.status).toBe(200);
    expect(cookiesFrom(res).some((c) => c.startsWith('accessToken='))).toBe(true);
  });

  it('refuses a wrong password', async () => {
    await registerVerified();

    const res = await request(app)
      .post(LOGIN)
      .send({ email: credentials.email, password: 'wrong-password' });

    expect(res.status).toBe(401);
  });

  it('never returns the password hash', async () => {
    await registerVerified();

    const res = await request(app)
      .post(LOGIN)
      .send({ email: credentials.email, password: credentials.password });

    expect(res.body.data).not.toHaveProperty('password');
    expect(res.body.data).not.toHaveProperty('refreshToken');
  });
});

describe('login status enforcement', () => {
  const statuses = ['graduated', 'archived', 'inactive'] as const;

  for (const status of statuses) {
    it(`refuses a ${status} account`, async () => {
      await registerVerified();
      await User.update({ status }, { where: { email: credentials.email } });

      const res = await request(app)
        .post(LOGIN)
        .send({ email: credentials.email, password: credentials.password });

      expect(res.status).toBe(403);
    });
  }

  it('still allows an active account', async () => {
    await registerVerified();
    await User.update(
      { status: 'active' },
      { where: { email: credentials.email } },
    );

    const res = await request(app)
      .post(LOGIN)
      .send({ email: credentials.email, password: credentials.password });

    expect(res.status).toBe(200);
  });
});

describe('GET /auth/current-user', () => {
  it('rejects an unauthenticated request', async () => {
    const res = await request(app).get(CURRENT);
    expect(res.status).toBe(401);
  });

  it('returns the caller when authenticated', async () => {
    await registerVerified();
    const cookies = await signIn();

    const res = await request(app).get(CURRENT).set('Cookie', cookies);

    expect(res.status).toBe(200);
    expect(res.body.data.email).toBe(credentials.email);
    expect(res.body.data).not.toHaveProperty('password');
    expect(res.body.data).not.toHaveProperty('refreshToken');
  });
});

describe('POST /auth/refresh-access-token', () => {
  it('rejects a request with no refresh cookie', async () => {
    const res = await request(app).post(REFRESH);
    expect(res.status).toBe(401);
  });

  it('issues a new token pair', async () => {
    await registerVerified();
    const cookies = await signIn();

    const res = await request(app).post(REFRESH).set('Cookie', cookies);

    expect(res.status).toBe(200);
    const rotated = cookiesFrom(res);
    expect(rotated.some((c) => c.startsWith('accessToken='))).toBe(true);
    expect(rotated.some((c) => c.startsWith('refreshToken='))).toBe(true);
  });

  // Regression guard: this endpoint previously returned the raw unscoped model,
  // leaking the bcrypt hash and the refresh token to the client.
  it('never leaks the password hash or refresh token', async () => {
    await registerVerified();
    const cookies = await signIn();

    const res = await request(app).post(REFRESH).set('Cookie', cookies);

    expect(res.body.data).not.toHaveProperty('password');
    expect(res.body.data).not.toHaveProperty('refreshToken');
  });

  it('invalidates the previous refresh token after rotation', async () => {
    await registerVerified();
    const original = await signIn();

    await request(app).post(REFRESH).set('Cookie', original);
    const replay = await request(app).post(REFRESH).set('Cookie', original);

    expect(replay.status).toBe(401);
  });
});

describe('POST /auth/logout', () => {
  it('clears the stored refresh token', async () => {
    await registerVerified();
    const cookies = await signIn();

    const res = await request(app).post(LOGOUT).set('Cookie', cookies);
    expect(res.status).toBe(200);

    const user = await User.unscoped().findOne({
      where: { email: credentials.email },
    });
    expect(user?.refreshToken).toBeNull();
  });
});

describe('POST /auth/change-password', () => {
  it('changes the password, clears the stored refresh token, and the new password works for a fresh login', async () => {
    await registerVerified();
    const cookies = await signIn();

    const res = await request(app)
      .post(CHANGE_PASSWORD)
      .set('Cookie', cookies)
      .send({ currentPassword: credentials.password, newPassword: 'newHunter3secret' });
    expect(res.status).toBe(200);

    // Same defensive clear as logout/deactivate/graduate — other sessions
    // get logged out the next time they try to refresh.
    const user = await User.unscoped().findOne({
      where: { email: credentials.email },
    });
    expect(user?.refreshToken).toBeNull();

    const oldLogin = await request(app)
      .post(LOGIN)
      .send({ email: credentials.email, password: credentials.password });
    expect(oldLogin.status).toBe(401);

    const newLogin = await request(app)
      .post(LOGIN)
      .send({ email: credentials.email, password: 'newHunter3secret' });
    expect(newLogin.status).toBe(200);
  });

  it('rejects an incorrect current password and leaves the password unchanged', async () => {
    await registerVerified();
    const cookies = await signIn();

    const res = await request(app)
      .post(CHANGE_PASSWORD)
      .set('Cookie', cookies)
      .send({ currentPassword: 'wrongPassword123', newPassword: 'newHunter3secret' });
    expect(res.status).toBe(400);

    const stillWorks = await request(app).post(LOGIN).send(credentials);
    expect(stillWorks.status).toBe(200);
  });

  it('requires authentication', async () => {
    const res = await request(app)
      .post(CHANGE_PASSWORD)
      .send({ currentPassword: 'x', newPassword: 'newHunter3secret' });
    expect(res.status).toBe(401);
  });
});
