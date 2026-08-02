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
