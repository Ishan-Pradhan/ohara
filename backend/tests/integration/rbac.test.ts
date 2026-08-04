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

const ADMIN_USERS = '/api/v1/admin/users';
const ADMIN_STATS = '/api/v1/admin/stats';
const PASSWORD = 'hunter2secret';

type Role = 'admin' | 'teacher' | 'student' | 'alumni';

/**
 * Registers a user, forces their role and verification, and returns their auth
 * cookies. The role is forced rather than inferred because the first account
 * to register is automatically promoted to admin.
 */
const signInAs = async (email: string, role: Role): Promise<string[]> => {
  await request(app)
    .post('/api/v1/auth/register')
    .send({ name: 'Test User', email, password: PASSWORD });

  await User.update({ isVerified: true, role }, { where: { email } });

  const login = await request(app)
    .post('/api/v1/auth/login')
    .send({ email, password: PASSWORD });

  return cookiesFrom(login);
};

beforeEach(async () => {
  await truncateAll();
});

afterAll(async () => {
  await closeDb();
});

describe('GET /admin/users', () => {
  it('rejects an unauthenticated caller with 401', async () => {
    const res = await request(app).get(ADMIN_USERS);
    expect(res.status).toBe(401);
  });

  it('allows an admin caller', async () => {
    const cookies = await signInAs('admin@example.com', 'admin');
    const res = await request(app).get(ADMIN_USERS).set('Cookie', cookies);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  const forbidden: Role[] = ['teacher', 'student', 'alumni'];

  for (const role of forbidden) {
    it(`rejects a ${role} with 403`, async () => {
      const cookies = await signInAs(`${role}@example.com`, role);
      const res = await request(app).get(ADMIN_USERS).set('Cookie', cookies);

      expect(res.status).toBe(403);
    });
  }

  it('never leaks password hashes in the user list', async () => {
    const cookies = await signInAs('admin@example.com', 'admin');
    const res = await request(app).get(ADMIN_USERS).set('Cookie', cookies);

    expect(JSON.stringify(res.body)).not.toContain('$2b$');
    expect(JSON.stringify(res.body)).not.toContain('$2a$');
  });

  it('filters by role', async () => {
    const cookies = await signInAs('admin@example.com', 'admin');
    await signInAs('teacher-filter@example.com', 'teacher');
    await signInAs('student-filter@example.com', 'student');

    const res = await request(app)
      .get(ADMIN_USERS)
      .query({ role: 'teacher' })
      .set('Cookie', cookies);

    expect(res.status).toBe(200);
    expect(res.body.data.items.length).toBeGreaterThan(0);
    for (const user of res.body.data.items) {
      expect(user.role).toBe('teacher');
    }
  });
});

describe('POST /admin/users', () => {
  it('rejects an unauthenticated caller with 401', async () => {
    const res = await request(app)
      .post(ADMIN_USERS)
      .send({ name: 'New Teacher', email: 'new-teacher@example.com', role: 'teacher' });
    expect(res.status).toBe(401);
  });

  const forbidden: Role[] = ['teacher', 'student', 'alumni'];

  for (const role of forbidden) {
    it(`rejects a ${role} with 403`, async () => {
      const cookies = await signInAs(`${role}-creator@example.com`, role);
      const res = await request(app)
        .post(ADMIN_USERS)
        .set('Cookie', cookies)
        .send({ name: 'New Teacher', email: 'new-teacher@example.com', role: 'teacher' });
      expect(res.status).toBe(403);
    });
  }

  it('rejects a student role in the body with 400', async () => {
    const cookies = await signInAs('admin@example.com', 'admin');
    const res = await request(app)
      .post(ADMIN_USERS)
      .set('Cookie', cookies)
      .send({ name: 'Sneaky', email: 'sneaky@example.com', role: 'student' });
    expect(res.status).toBe(400);
  });

  it('creates an unverified teacher account and never returns a password', async () => {
    const cookies = await signInAs('admin@example.com', 'admin');
    const res = await request(app)
      .post(ADMIN_USERS)
      .set('Cookie', cookies)
      .send({ name: 'New Teacher', email: 'new-teacher@example.com', role: 'teacher' });

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      name: 'New Teacher',
      email: 'new-teacher@example.com',
      role: 'teacher',
      isVerified: false,
    });
    expect(res.body.data).not.toHaveProperty('password');

    const created = await User.findOne({ where: { email: 'new-teacher@example.com' } });
    expect(created?.isVerified).toBe(false);
  });

  it('rejects a duplicate email with 400', async () => {
    const cookies = await signInAs('admin@example.com', 'admin');
    await request(app)
      .post(ADMIN_USERS)
      .set('Cookie', cookies)
      .send({ name: 'First', email: 'dup@example.com', role: 'teacher' });

    const res = await request(app)
      .post(ADMIN_USERS)
      .set('Cookie', cookies)
      .send({ name: 'Second', email: 'dup@example.com', role: 'admin' });

    expect(res.status).toBe(400);
  });

  it("activates the account when the invited user sets their password via the reset-token flow", async () => {
    const cookies = await signInAs('admin@example.com', 'admin');
    await request(app)
      .post(ADMIN_USERS)
      .set('Cookie', cookies)
      .send({ name: 'New Teacher', email: 'invited-teacher@example.com', role: 'teacher' });

    const { Verification } = await import('../../src/models/verification.model.js');
    const created = await User.findOne({ where: { email: 'invited-teacher@example.com' } });
    const resetRecord = await Verification.findOne({
      where: { userId: created?.id, type: 'passwordReset' },
    });
    expect(resetRecord).not.toBeNull();

    const resetRes = await request(app)
      .post('/api/v1/auth/reset-password')
      .send({ token: resetRecord?.token, newPassword: 'brandNewPassword1' });
    expect(resetRes.status).toBe(200);

    const activated = await User.findOne({ where: { email: 'invited-teacher@example.com' } });
    expect(activated?.isVerified).toBe(true);

    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'invited-teacher@example.com', password: 'brandNewPassword1' });
    expect(loginRes.status).toBe(200);
  });
});

describe('POST /admin/users/batch', () => {
  const ADMIN_USERS_BATCH = '/api/v1/admin/users/batch';

  it('rejects an unauthenticated caller with 401', async () => {
    const res = await request(app)
      .post(ADMIN_USERS_BATCH)
      .send({ role: 'student', users: [{ name: 'A', email: 'a@example.com' }] });
    expect(res.status).toBe(401);
  });

  const forbidden: Role[] = ['teacher', 'student', 'alumni'];

  for (const role of forbidden) {
    it(`rejects a ${role} with 403`, async () => {
      const cookies = await signInAs(`${role}-batch@example.com`, role);
      const res = await request(app)
        .post(ADMIN_USERS_BATCH)
        .set('Cookie', cookies)
        .send({ role: 'student', users: [{ name: 'A', email: 'a@example.com' }] });
      expect(res.status).toBe(403);
    });
  }

  it('rejects an empty list with 400', async () => {
    const cookies = await signInAs('admin@example.com', 'admin');
    const res = await request(app)
      .post(ADMIN_USERS_BATCH)
      .set('Cookie', cookies)
      .send({ role: 'student', users: [] });
    expect(res.status).toBe(400);
  });

  it('invites every row as an unverified student', async () => {
    const cookies = await signInAs('admin@example.com', 'admin');
    const res = await request(app)
      .post(ADMIN_USERS_BATCH)
      .set('Cookie', cookies)
      .send({
        role: 'student',
        users: [
          { name: 'Priya Sharma', email: 'priya@example.com' },
          { name: 'Ram Thapa', email: 'ram@example.com' },
        ],
      });

    expect(res.status).toBe(201);
    expect(res.body.data.invited).toHaveLength(2);
    expect(res.body.data.skipped).toHaveLength(0);
    for (const person of res.body.data.invited) {
      expect(person.role).toBe('student');
      expect(person.isVerified).toBe(false);
      expect(person).not.toHaveProperty('password');
    }
  });

  it('skips a duplicate email without failing the rest of the batch', async () => {
    const cookies = await signInAs('admin@example.com', 'admin');
    await request(app)
      .post(ADMIN_USERS_BATCH)
      .set('Cookie', cookies)
      .send({ role: 'student', users: [{ name: 'Priya Sharma', email: 'priya@example.com' }] });

    const res = await request(app)
      .post(ADMIN_USERS_BATCH)
      .set('Cookie', cookies)
      .send({
        role: 'student',
        users: [
          { name: 'Priya Sharma', email: 'priya@example.com' },
          { name: 'Ram Thapa', email: 'ram@example.com' },
        ],
      });

    expect(res.status).toBe(201);
    expect(res.body.data.invited).toHaveLength(1);
    expect(res.body.data.skipped).toEqual([
      { email: 'priya@example.com', reason: 'Email already exists' },
    ]);
  });

  it('lets an invited student set their password and log in', async () => {
    const cookies = await signInAs('admin@example.com', 'admin');
    await request(app)
      .post(ADMIN_USERS_BATCH)
      .set('Cookie', cookies)
      .send({ role: 'student', users: [{ name: 'Priya Sharma', email: 'priya@example.com' }] });

    const { Verification } = await import('../../src/models/verification.model.js');
    const created = await User.findOne({ where: { email: 'priya@example.com' } });
    const resetRecord = await Verification.findOne({
      where: { userId: created?.id, type: 'passwordReset' },
    });
    expect(resetRecord).not.toBeNull();

    const resetRes = await request(app)
      .post('/api/v1/auth/reset-password')
      .send({ token: resetRecord?.token, newPassword: 'brandNewPassword1' });
    expect(resetRes.status).toBe(200);

    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'priya@example.com', password: 'brandNewPassword1' });
    expect(loginRes.status).toBe(200);
  });
});

describe('GET /admin/stats', () => {
  it('rejects a student with 403', async () => {
    const cookies = await signInAs('student@example.com', 'student');
    const res = await request(app).get(ADMIN_STATS).set('Cookie', cookies);

    expect(res.status).toBe(403);
  });

  it('allows an admin', async () => {
    const cookies = await signInAs('admin@example.com', 'admin');
    const res = await request(app).get(ADMIN_STATS).set('Cookie', cookies);

    expect(res.status).toBe(200);
  });
});
