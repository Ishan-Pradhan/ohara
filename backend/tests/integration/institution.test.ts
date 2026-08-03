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

const PROGRAMS = '/api/v1/admin/programs';
const PASSWORD = 'hunter2secret';

type Role = 'admin' | 'teacher' | 'student' | 'alumni';

/** Same pattern as tests/integration/rbac.test.ts's local helper. */
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

describe('POST /admin/programs', () => {
  it('rejects an unauthenticated caller with 401', async () => {
    const res = await request(app)
      .post(PROGRAMS)
      .send({ name: 'Engineering', institutionType: 'college' });
    expect(res.status).toBe(401);
  });

  it('rejects a non-admin caller with 403', async () => {
    const cookies = await signInAs('teacher@example.com', 'teacher');
    const res = await request(app)
      .post(PROGRAMS)
      .set('Cookie', cookies)
      .send({ name: 'Engineering', institutionType: 'college' });
    expect(res.status).toBe(403);
  });

  it('rejects a missing name with 400', async () => {
    const cookies = await signInAs('admin@example.com', 'admin');
    const res = await request(app)
      .post(PROGRAMS)
      .set('Cookie', cookies)
      .send({ institutionType: 'college' });
    expect(res.status).toBe(400);
  });

  it('creates a program as admin', async () => {
    const cookies = await signInAs('admin@example.com', 'admin');
    const res = await request(app)
      .post(PROGRAMS)
      .set('Cookie', cookies)
      .send({
        name: 'Engineering',
        institutionType: 'college',
        description: 'STEM programs',
      });

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      name: 'Engineering',
      institutionType: 'college',
      description: 'STEM programs',
    });
  });
});

describe('GET /admin/programs', () => {
  it('lists created programs', async () => {
    const cookies = await signInAs('admin@example.com', 'admin');
    await request(app)
      .post(PROGRAMS)
      .set('Cookie', cookies)
      .send({ name: 'Engineering', institutionType: 'college' });

    const res = await request(app).get(PROGRAMS).set('Cookie', cookies);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].name).toBe('Engineering');
  });
});
