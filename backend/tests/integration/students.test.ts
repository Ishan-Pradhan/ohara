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
  createProgram,
  createClass,
  createSection,
  createAcademicYear,
  createCourse,
  createStudentUser,
  createTeacherUser,
  createBatch,
} = await import('../helpers/institution.js');
const { courseTeacherRepository } = await import(
  '../../src/repositories/courseTeachers.repository.js'
);

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

/** Places `studentId` into `sectionId` (under `batchId`) for the current year and enrolls in
 * `courseId`. */
const placeAndEnroll = async (
  adminCookies: string[],
  studentId: string,
  sectionId: string,
  courseId: string,
  batchId: string,
) => {
  await request(app)
    .post('/api/v1/admin/class-memberships')
    .set('Cookie', adminCookies)
    .send({ studentId, sectionId, batchId });
  await request(app)
    .post('/api/v1/admin/enrollments')
    .set('Cookie', adminCookies)
    .send({ studentId, courseId });
};

beforeEach(async () => {
  await truncateAll();
});

afterAll(async () => {
  await closeDb();
});

describe('GET /students/:studentId/placement', () => {
  it('rejects an unauthenticated caller with 401', async () => {
    const student = await createStudentUser();
    const res = await request(app).get(`/api/v1/students/${student.id}/placement`);
    expect(res.status).toBe(401);
  });

  it("allows an admin to view any student's placement", async () => {
    const adminCookies = await signInAs('admin@example.com', 'admin');
    const program = await createProgram({ institutionType: 'college' });
    const cls = await createClass({ programId: program.id });
    const year = await createAcademicYear({ isCurrent: true });
    const section = await createSection({ classId: cls.id, academicYearId: year.id });
    const course = await createCourse({ classId: cls.id, title: 'Physics' });
    const batch = await createBatch({ programId: program.id });
    const student = await createStudentUser();

    await placeAndEnroll(adminCookies, student.id, section.id, course.id, batch.id);

    const res = await request(app)
      .get(`/api/v1/students/${student.id}/placement`)
      .set('Cookie', adminCookies);

    expect(res.status).toBe(200);
    expect(res.body.data.studentId).toBe(student.id);
    expect(res.body.data.section.id).toBe(section.id);
    expect(res.body.data.courses).toHaveLength(1);
    expect(res.body.data.courses[0].title).toBe('Physics');
  });

  it('allows a student to view their own placement', async () => {
    const adminCookies = await signInAs('admin@example.com', 'admin');
    const cls = await createClass();
    const year = await createAcademicYear({ isCurrent: true });
    const section = await createSection({ classId: cls.id, academicYearId: year.id });
    const course = await createCourse({ classId: cls.id });
    const batch = await createBatch({ programId: cls.programId });
    const student = await createStudentUser({ email: 'self@example.com' });

    await placeAndEnroll(adminCookies, student.id, section.id, course.id, batch.id);

    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'self@example.com', password: PASSWORD });
    const studentCookies = cookiesFrom(login);

    const res = await request(app)
      .get(`/api/v1/students/${student.id}/placement`)
      .set('Cookie', studentCookies);

    expect(res.status).toBe(200);
    expect(res.body.data.studentId).toBe(student.id);
  });

  it('rejects an unrelated student with 403', async () => {
    const adminCookies = await signInAs('admin@example.com', 'admin');
    const cls = await createClass();
    const year = await createAcademicYear({ isCurrent: true });
    const section = await createSection({ classId: cls.id, academicYearId: year.id });
    const course = await createCourse({ classId: cls.id });
    const batch = await createBatch({ programId: cls.programId });
    const student = await createStudentUser();
    await placeAndEnroll(adminCookies, student.id, section.id, course.id, batch.id);

    const unrelatedCookies = await signInAs('other-student@example.com', 'student');

    const res = await request(app)
      .get(`/api/v1/students/${student.id}/placement`)
      .set('Cookie', unrelatedCookies);

    expect(res.status).toBe(403);
  });

  it('allows a teacher of an enrolled course to view the placement', async () => {
    const adminCookies = await signInAs('admin@example.com', 'admin');
    const cls = await createClass();
    const year = await createAcademicYear({ isCurrent: true });
    const section = await createSection({ classId: cls.id, academicYearId: year.id });
    const course = await createCourse({ classId: cls.id });
    const batch = await createBatch({ programId: cls.programId });
    const student = await createStudentUser();
    await placeAndEnroll(adminCookies, student.id, section.id, course.id, batch.id);

    const teacher = await createTeacherUser({ email: 'teaches-them@example.com' });
    await courseTeacherRepository.assign({ teacherId: teacher.id, courseId: course.id });

    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'teaches-them@example.com', password: PASSWORD });
    const teacherCookies = cookiesFrom(login);

    const res = await request(app)
      .get(`/api/v1/students/${student.id}/placement`)
      .set('Cookie', teacherCookies);

    expect(res.status).toBe(200);
    expect(res.body.data.courses[0].teachers[0].id).toBe(teacher.id);
  });

  it("rejects a teacher who does not teach any of the student's courses with 403", async () => {
    const adminCookies = await signInAs('admin@example.com', 'admin');
    const cls = await createClass();
    const year = await createAcademicYear({ isCurrent: true });
    const section = await createSection({ classId: cls.id, academicYearId: year.id });
    const course = await createCourse({ classId: cls.id });
    const batch = await createBatch({ programId: cls.programId });
    const student = await createStudentUser();
    await placeAndEnroll(adminCookies, student.id, section.id, course.id, batch.id);

    await createTeacherUser({ email: 'unrelated-teacher@example.com' });
    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'unrelated-teacher@example.com', password: PASSWORD });
    const teacherCookies = cookiesFrom(login);

    const res = await request(app)
      .get(`/api/v1/students/${student.id}/placement`)
      .set('Cookie', teacherCookies);

    expect(res.status).toBe(403);
  });

  it('returns 404 when the student has no current-year placement', async () => {
    const adminCookies = await signInAs('admin@example.com', 'admin');
    await createAcademicYear({ isCurrent: true });
    const student = await createStudentUser();

    const res = await request(app)
      .get(`/api/v1/students/${student.id}/placement`)
      .set('Cookie', adminCookies);

    expect(res.status).toBe(404);
  });
});
