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

const { createProgram } = await import('../helpers/institution.js');

const CLASSES = '/api/v1/admin/classes';

describe('POST /admin/classes', () => {
  it('rejects an unauthenticated caller with 401', async () => {
    const res = await request(app)
      .post(CLASSES)
      .send({ programId: 'x', name: 'Grade 10', orderIndex: 1 });
    expect(res.status).toBe(401);
  });

  it('rejects a non-admin caller with 403', async () => {
    const cookies = await signInAs('teacher@example.com', 'teacher');
    const program = await createProgram();
    const res = await request(app)
      .post(CLASSES)
      .set('Cookie', cookies)
      .send({ programId: program.id, name: 'Grade 10', orderIndex: 1 });
    expect(res.status).toBe(403);
  });

  it('rejects a non-existent programId with 404', async () => {
    const cookies = await signInAs('admin@example.com', 'admin');
    const res = await request(app)
      .post(CLASSES)
      .set('Cookie', cookies)
      .send({
        programId: '00000000-0000-0000-0000-000000000000',
        name: 'Grade 10',
        orderIndex: 1,
      });
    expect(res.status).toBe(404);
  });

  it('creates a class as admin', async () => {
    const cookies = await signInAs('admin@example.com', 'admin');
    const program = await createProgram();
    const res = await request(app)
      .post(CLASSES)
      .set('Cookie', cookies)
      .send({ programId: program.id, name: 'Grade 10', orderIndex: 1 });

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      programId: program.id,
      name: 'Grade 10',
      orderIndex: 1,
    });
  });

  it('rejects a duplicate (programId, orderIndex) with 400', async () => {
    const cookies = await signInAs('admin@example.com', 'admin');
    const program = await createProgram();
    await request(app)
      .post(CLASSES)
      .set('Cookie', cookies)
      .send({ programId: program.id, name: 'Grade 10', orderIndex: 1 });

    const res = await request(app)
      .post(CLASSES)
      .set('Cookie', cookies)
      .send({ programId: program.id, name: 'Grade 10 (alt)', orderIndex: 1 });

    expect(res.status).toBe(400);
  });
});

describe('GET /admin/classes', () => {
  it('filters by programId', async () => {
    const cookies = await signInAs('admin@example.com', 'admin');
    const programA = await createProgram({ name: 'A' });
    const programB = await createProgram({ name: 'B' });
    await request(app)
      .post(CLASSES)
      .set('Cookie', cookies)
      .send({ programId: programA.id, name: 'Grade 10', orderIndex: 1 });
    await request(app)
      .post(CLASSES)
      .set('Cookie', cookies)
      .send({ programId: programB.id, name: 'Year 1', orderIndex: 1 });

    const res = await request(app)
      .get(CLASSES)
      .query({ programId: programA.id })
      .set('Cookie', cookies);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].name).toBe('Grade 10');
  });
});

const YEARS = '/api/v1/admin/academic-years';

describe('POST /admin/academic-years', () => {
  it('creates a non-current year by default', async () => {
    const cookies = await signInAs('admin@example.com', 'admin');
    const res = await request(app)
      .post(YEARS)
      .set('Cookie', cookies)
      .send({ name: '2025-2026', startDate: '2025-06-01', endDate: '2026-05-31' });

    expect(res.status).toBe(201);
    expect(res.body.data.isCurrent).toBe(false);
  });

  it('flips the previous current year when a new one is created current', async () => {
    const cookies = await signInAs('admin@example.com', 'admin');
    const yearA = await request(app)
      .post(YEARS)
      .set('Cookie', cookies)
      .send({
        name: '2025-2026',
        startDate: '2025-06-01',
        endDate: '2026-05-31',
        isCurrent: true,
      });
    expect(yearA.body.data.isCurrent).toBe(true);

    const yearB = await request(app)
      .post(YEARS)
      .set('Cookie', cookies)
      .send({
        name: '2026-2027',
        startDate: '2026-06-01',
        endDate: '2027-05-31',
        isCurrent: true,
      });
    expect(yearB.body.data.isCurrent).toBe(true);

    const list = await request(app).get(YEARS).set('Cookie', cookies);
    const current = list.body.data.filter((y: { isCurrent: boolean }) => y.isCurrent);
    expect(current).toHaveLength(1);
    expect(current[0].id).toBe(yearB.body.data.id);
  });
});
