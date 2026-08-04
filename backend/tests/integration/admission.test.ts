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
  createAcademicYear,
  createProgram,
  createClass,
  createCourse,
} = await import('../helpers/institution.js');

const ADMIT = '/api/v1/admin/students/admit';
const ENROLLMENTS = '/api/v1/admin/enrollments';
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

describe('POST /admin/students/admit', () => {
  it('admits a student: creates the account, places them, and auto-enrolls compulsory courses only', async () => {
    const cookies = await signInAs('admin@example.com', 'admin');

    const program = await createProgram({ institutionType: 'college' });
    const cls = await createClass({ programId: program.id });
    const year = await createAcademicYear({ isCurrent: true });
    const section = await createSection({ classId: cls.id, academicYearId: year.id, name: 'A' });
    const compulsoryCourse = await createCourse({
      classId: cls.id,
      title: 'Physics',
      code: `PHYS-${Date.now()}`,
      courseType: 'compulsory',
    });
    const electiveCourse = await createCourse({
      classId: cls.id,
      title: 'Art',
      code: `ART-${Date.now()}`,
      courseType: 'elective',
    });

    const res = await request(app)
      .post(ADMIT)
      .set('Cookie', cookies)
      .send({
        name: 'Test Student',
        email: 'admit-test@example.com',
        sectionId: section.id,
        parentName: 'Test Parent',
        parentPhone: '9800000000',
      });

    expect(res.status).toBe(201);
    expect(res.body.data.student.email).toBe('admit-test@example.com');
    expect(res.body.data.membership).toMatchObject({
      studentId: res.body.data.student.id,
      sectionId: section.id,
      academicYearId: year.id,
    });

    const enrollments = await request(app)
      .get(ENROLLMENTS)
      .query({ studentId: res.body.data.student.id })
      .set('Cookie', cookies);
    const enrolledCourseIds = enrollments.body.data.map((e: { courseId: string }) => e.courseId);
    expect(enrolledCourseIds).toContain(compulsoryCourse.id);
    expect(enrolledCourseIds).not.toContain(electiveCourse.id);
  });

  it('rejects admission into a nonexistent section', async () => {
    const cookies = await signInAs('admin@example.com', 'admin');

    const res = await request(app)
      .post(ADMIT)
      .set('Cookie', cookies)
      .send({
        name: 'X',
        email: 'x@example.com',
        sectionId: '00000000-0000-0000-0000-000000000000',
      });

    expect(res.status).toBe(404);
  });

  it('rejects admission with a duplicate email', async () => {
    const cookies = await signInAs('admin@example.com', 'admin');
    const section = await createSection();
    const existingStudent = await createStudentUser();

    const res = await request(app)
      .post(ADMIT)
      .set('Cookie', cookies)
      .send({ name: 'Dup', email: existingStudent.email, sectionId: section.id });

    expect(res.status).toBe(400);
  });
});
