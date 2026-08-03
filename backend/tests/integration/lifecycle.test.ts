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
const { createStudentUser, createSection } = await import('../helpers/institution.js');

const PASSWORD = 'hunter2secret';

type Role = 'admin' | 'teacher' | 'student' | 'alumni';

/** Same pattern as tests/integration/institution.test.ts's local helper. */
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

describe('PATCH /admin/users/:id/archive', () => {
  it('rejects an unauthenticated caller with 401', async () => {
    const student = await createStudentUser();
    const res = await request(app).patch(`/api/v1/admin/users/${student.id}/archive`);
    expect(res.status).toBe(401);
  });

  it('rejects a non-admin caller with 403', async () => {
    const cookies = await signInAs('teacher@example.com', 'teacher');
    const student = await createStudentUser();
    const res = await request(app)
      .patch(`/api/v1/admin/users/${student.id}/archive`)
      .set('Cookie', cookies);
    expect(res.status).toBe(403);
  });

  it('rejects a non-existent user with 404', async () => {
    const cookies = await signInAs('admin@example.com', 'admin');
    const res = await request(app)
      .patch('/api/v1/admin/users/00000000-0000-0000-0000-000000000000/archive')
      .set('Cookie', cookies);
    expect(res.status).toBe(404);
  });

  it('archives a student as admin', async () => {
    const cookies = await signInAs('admin@example.com', 'admin');
    const student = await createStudentUser();
    const res = await request(app)
      .patch(`/api/v1/admin/users/${student.id}/archive`)
      .set('Cookie', cookies);

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('archived');
  });
});

describe('DELETE /admin/users/:id', () => {
  it('rejects a request without confirmHardDelete with 400', async () => {
    const cookies = await signInAs('admin@example.com', 'admin');
    const student = await createStudentUser();
    const res = await request(app)
      .delete(`/api/v1/admin/users/${student.id}`)
      .set('Cookie', cookies)
      .send({});
    expect(res.status).toBe(400);
  });

  it('rejects a non-existent user with 404', async () => {
    const cookies = await signInAs('admin@example.com', 'admin');
    const res = await request(app)
      .delete('/api/v1/admin/users/00000000-0000-0000-0000-000000000000')
      .set('Cookie', cookies)
      .send({ confirmHardDelete: true });
    expect(res.status).toBe(404);
  });

  it('permanently deletes a student with no academic records', async () => {
    const cookies = await signInAs('admin@example.com', 'admin');
    const student = await createStudentUser();
    const res = await request(app)
      .delete(`/api/v1/admin/users/${student.id}`)
      .set('Cookie', cookies)
      .send({ confirmHardDelete: true });

    expect(res.status).toBe(200);

    const check = await User.findByPk(student.id);
    expect(check).toBeNull();
  });

  it('rejects hard-deleting a student with existing class memberships with 409', async () => {
    const cookies = await signInAs('admin@example.com', 'admin');
    const section = await createSection();
    const student = await createStudentUser();
    await request(app)
      .post('/api/v1/admin/class-memberships')
      .set('Cookie', cookies)
      .send({ studentId: student.id, sectionId: section.id });

    const res = await request(app)
      .delete(`/api/v1/admin/users/${student.id}`)
      .set('Cookie', cookies)
      .send({ confirmHardDelete: true });

    expect(res.status).toBe(409);
  });
});
