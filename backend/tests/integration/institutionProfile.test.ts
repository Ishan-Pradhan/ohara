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

const PROFILE = '/api/v1/institution-profile';
const PASSWORD = 'hunter2secret';

type Role = 'admin' | 'teacher' | 'student' | 'alumni';

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

describe('GET /institution-profile', () => {
  it('returns null when nothing has been configured, with no auth required', async () => {
    const res = await request(app).get(PROFILE);

    expect(res.status).toBe(200);
    expect(res.body.data).toBeNull();
  });

  it('returns the saved profile once an admin has set one', async () => {
    const cookies = await signInAs('admin@example.com', 'admin');
    await request(app)
      .patch(PROFILE)
      .set('Cookie', cookies)
      .send({ name: 'NCCS College' });

    const res = await request(app).get(PROFILE);

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ name: 'NCCS College' });
  });
});

describe('PATCH /institution-profile', () => {
  it('rejects an unauthenticated caller with 401', async () => {
    const res = await request(app).patch(PROFILE).send({ name: 'NCCS College' });
    expect(res.status).toBe(401);
  });

  const forbidden: Role[] = ['teacher', 'student', 'alumni'];

  for (const role of forbidden) {
    it(`rejects a ${role} with 403`, async () => {
      const cookies = await signInAs(`${role}@example.com`, role);
      const res = await request(app)
        .patch(PROFILE)
        .set('Cookie', cookies)
        .send({ name: 'NCCS College' });
      expect(res.status).toBe(403);
    });
  }

  it('creates the singleton row on first save', async () => {
    const cookies = await signInAs('admin@example.com', 'admin');
    const res = await request(app)
      .patch(PROFILE)
      .set('Cookie', cookies)
      .send({ name: 'NCCS College', tagline: 'Since 1998' });

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ name: 'NCCS College', tagline: 'Since 1998' });
  });

  it('updates the same row on a second save rather than creating another', async () => {
    const cookies = await signInAs('admin@example.com', 'admin');
    const first = await request(app)
      .patch(PROFILE)
      .set('Cookie', cookies)
      .send({ name: 'NCCS College' });

    const second = await request(app)
      .patch(PROFILE)
      .set('Cookie', cookies)
      .send({ name: 'NCCS College (renamed)' });

    expect(second.body.data.id).toBe(first.body.data.id);

    const { InstitutionProfile } = await import(
      '../../src/models/institutionProfile.model.js'
    );
    expect(await InstitutionProfile.count()).toBe(1);
  });

  it('normalizes an allowedEmailDomain to lowercase', async () => {
    const cookies = await signInAs('admin@example.com', 'admin');
    const res = await request(app)
      .patch(PROFILE)
      .set('Cookie', cookies)
      .send({ name: 'NCCS College', allowedEmailDomain: 'NCCS.EDU.NP' });

    expect(res.body.data.allowedEmailDomain).toBe('nccs.edu.np');
  });

  it('rejects a malformed domain with 400', async () => {
    const cookies = await signInAs('admin@example.com', 'admin');
    const res = await request(app)
      .patch(PROFILE)
      .set('Cookie', cookies)
      .send({ name: 'NCCS College', allowedEmailDomain: 'not a domain' });

    expect(res.status).toBe(400);
  });

  it('defaults selfRegistrationEnabled to true', async () => {
    const cookies = await signInAs('admin@example.com', 'admin');
    const res = await request(app)
      .patch(PROFILE)
      .set('Cookie', cookies)
      .send({ name: 'NCCS College' });

    expect(res.body.data.selfRegistrationEnabled).toBe(true);
  });

  it('can be turned off to close self-registration', async () => {
    const cookies = await signInAs('admin@example.com', 'admin');
    const res = await request(app)
      .patch(PROFILE)
      .set('Cookie', cookies)
      .send({ name: 'NCCS College', selfRegistrationEnabled: false });

    expect(res.body.data.selfRegistrationEnabled).toBe(false);
  });
});
