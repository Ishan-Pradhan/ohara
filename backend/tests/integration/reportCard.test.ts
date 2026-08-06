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

describe('GET /students/:studentId/report-card', () => {
  it('generates a downloadable PDF for admin, the student themself, and a teaching teacher — and rejects everyone else', async () => {
    const adminCookies = await signInAs('admin@example.com', 'admin');
    const program = await createProgram({ institutionType: 'college' });
    const cls = await createClass({ programId: program.id });
    const year = await createAcademicYear({ isCurrent: true });
    const section = await createSection({ classId: cls.id, academicYearId: year.id });
    const course = await createCourse({ classId: cls.id, title: 'Physics' });
    const batch = await createBatch({ programId: program.id });
    const student = await createStudentUser({ email: `student-${Date.now()}@example.com` });
    const teacher = await createTeacherUser({ email: `teacher-${Date.now()}@example.com` });
    await courseTeacherRepository.assign({ teacherId: teacher.id, courseId: course.id });
    await placeAndEnroll(adminCookies, student.id, section.id, course.id, batch.id);

    const studentCookies = await signInAs(student.email, 'student');
    const teacherCookies = await signInAs(teacher.email, 'teacher');
    const outsiderStudent = await createStudentUser({ email: `outsider-${Date.now()}@example.com` });
    const outsiderCookies = await signInAs(outsiderStudent.email, 'student');
    const outsiderTeacher = await createTeacherUser({ email: `outsider-teacher-${Date.now()}@example.com` });
    const outsiderTeacherCookies = await signInAs(outsiderTeacher.email, 'teacher');

    for (const cookies of [adminCookies, studentCookies, teacherCookies]) {
      const res = await request(app)
        .get(`/api/v1/students/${student.id}/report-card`)
        .set('Cookie', cookies);
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toBe('application/pdf');
      expect(res.headers['content-disposition']).toContain('attachment');
      expect(Buffer.from(res.body).subarray(0, 4).toString()).toBe('%PDF');
    }

    const forbiddenStudent = await request(app)
      .get(`/api/v1/students/${student.id}/report-card`)
      .set('Cookie', outsiderCookies);
    expect(forbiddenStudent.status).toBe(403);

    const forbiddenTeacher = await request(app)
      .get(`/api/v1/students/${student.id}/report-card`)
      .set('Cookie', outsiderTeacherCookies);
    expect(forbiddenTeacher.status).toBe(403);
  });

  it('404s for a student with no current placement', async () => {
    const adminCookies = await signInAs('admin@example.com', 'admin');
    const student = await createStudentUser();
    const res = await request(app)
      .get(`/api/v1/students/${student.id}/report-card`)
      .set('Cookie', adminCookies);
    expect(res.status).toBe(404);
  });
});
