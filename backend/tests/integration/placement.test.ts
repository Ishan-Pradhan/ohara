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
const {
  createSection,
  createStudentUser,
  createTeacherUser,
  createAcademicYear,
} = await import('../helpers/institution.js');

const CLASS_MEMBERSHIPS = '/api/v1/admin/class-memberships';
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

describe('POST /admin/class-memberships', () => {
  it('rejects an unauthenticated caller with 401', async () => {
    const res = await request(app)
      .post(CLASS_MEMBERSHIPS)
      .send({ studentId: 'x', sectionId: 'y' });
    expect(res.status).toBe(401);
  });

  it('rejects a non-admin caller with 403', async () => {
    const cookies = await signInAs('teacher@example.com', 'teacher');
    const section = await createSection();
    const student = await createStudentUser();
    const res = await request(app)
      .post(CLASS_MEMBERSHIPS)
      .set('Cookie', cookies)
      .send({ studentId: student.id, sectionId: section.id });
    expect(res.status).toBe(403);
  });

  it('rejects a non-existent studentId with 404', async () => {
    const cookies = await signInAs('admin@example.com', 'admin');
    const section = await createSection();
    const res = await request(app)
      .post(CLASS_MEMBERSHIPS)
      .set('Cookie', cookies)
      .send({ studentId: '00000000-0000-0000-0000-000000000000', sectionId: section.id });
    expect(res.status).toBe(404);
  });

  it('rejects a studentId that is not a student with 400', async () => {
    const cookies = await signInAs('admin@example.com', 'admin');
    const section = await createSection();
    const teacher = await createTeacherUser();
    const res = await request(app)
      .post(CLASS_MEMBERSHIPS)
      .set('Cookie', cookies)
      .send({ studentId: teacher.id, sectionId: section.id });
    expect(res.status).toBe(400);
  });

  it('rejects a non-existent sectionId with 404', async () => {
    const cookies = await signInAs('admin@example.com', 'admin');
    const student = await createStudentUser();
    const res = await request(app)
      .post(CLASS_MEMBERSHIPS)
      .set('Cookie', cookies)
      .send({ studentId: student.id, sectionId: '00000000-0000-0000-0000-000000000000' });
    expect(res.status).toBe(404);
  });

  it('places a student into a section as admin', async () => {
    const cookies = await signInAs('admin@example.com', 'admin');
    const section = await createSection();
    const student = await createStudentUser();
    const res = await request(app)
      .post(CLASS_MEMBERSHIPS)
      .set('Cookie', cookies)
      .send({ studentId: student.id, sectionId: section.id });

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      studentId: student.id,
      sectionId: section.id,
      academicYearId: section.academicYearId,
      outcome: 'enrolled',
    });
  });

  it('rejects placing the same student twice in the same academic year with 400', async () => {
    const cookies = await signInAs('admin@example.com', 'admin');
    const year = await createAcademicYear();
    const sectionA = await createSection({ academicYearId: year.id });
    const sectionB = await createSection({ academicYearId: year.id, name: 'B' });
    const student = await createStudentUser();

    await request(app)
      .post(CLASS_MEMBERSHIPS)
      .set('Cookie', cookies)
      .send({ studentId: student.id, sectionId: sectionA.id });

    const res = await request(app)
      .post(CLASS_MEMBERSHIPS)
      .set('Cookie', cookies)
      .send({ studentId: student.id, sectionId: sectionB.id });

    expect(res.status).toBe(400);
  });
});

describe('GET /admin/class-memberships', () => {
  it('filters by studentId', async () => {
    const cookies = await signInAs('admin@example.com', 'admin');
    const section = await createSection();
    const studentA = await createStudentUser();
    const studentB = await createStudentUser();

    await request(app)
      .post(CLASS_MEMBERSHIPS)
      .set('Cookie', cookies)
      .send({ studentId: studentA.id, sectionId: section.id });
    await request(app)
      .post(CLASS_MEMBERSHIPS)
      .set('Cookie', cookies)
      .send({ studentId: studentB.id, sectionId: section.id });

    const res = await request(app)
      .get(CLASS_MEMBERSHIPS)
      .query({ studentId: studentA.id })
      .set('Cookie', cookies);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].studentId).toBe(studentA.id);
  });
});
