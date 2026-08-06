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

describe('Events', () => {
  it('scopes creation and relevance correctly across global/class/course, and enforces delete ownership', async () => {
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

    // Outsider (unrelated teacher, no course/class ties) should never see scoped events.
    const outsider = await createTeacherUser({ email: `outsider-${Date.now()}@example.com` });
    const outsiderCookies = await signInAs(outsider.email, 'teacher');

    // Teacher is rejected trying to create a program-scoped event.
    const rejected = await request(app)
      .post('/api/v1/events')
      .set('Cookie', teacherCookies)
      .send({ title: 'Bad', startAt: new Date(Date.now() + 3600_000).toISOString(), audience: 'program', programId: program.id });
    expect(rejected.status).toBe(403);

    // Admin creates a global event.
    const globalRes = await request(app)
      .post('/api/v1/events')
      .set('Cookie', adminCookies)
      .send({ title: 'Global Assembly', startAt: new Date(Date.now() + 3600_000).toISOString(), audience: 'global' });
    expect(globalRes.status).toBe(201);

    // Teacher creates a course-scoped event for their own course.
    const courseEventRes = await request(app)
      .post('/api/v1/events')
      .set('Cookie', teacherCookies)
      .send({
        title: 'Physics quiz review',
        startAt: new Date(Date.now() + 7200_000).toISOString(),
        audience: 'course',
        courseId: course.id,
      });
    expect(courseEventRes.status).toBe(201);
    const courseEventId = courseEventRes.body.data.id;

    // Teacher creates a class-scoped event.
    const classEventRes = await request(app)
      .post('/api/v1/events')
      .set('Cookie', teacherCookies)
      .send({
        title: 'Class trip',
        startAt: new Date(Date.now() + 10800_000).toISOString(),
        audience: 'class',
        classId: cls.id,
      });
    expect(classEventRes.status).toBe(201);

    // Student sees global + course + class events (all 3), sorted soonest-first.
    const studentEvents = await request(app).get('/api/v1/events/me').set('Cookie', studentCookies);
    expect(studentEvents.body.data.map((e: { title: string }) => e.title)).toEqual([
      'Global Assembly',
      'Physics quiz review',
      'Class trip',
    ]);

    // The teacher who created them also sees all 3.
    const teacherEvents = await request(app).get('/api/v1/events/me').set('Cookie', teacherCookies);
    expect(teacherEvents.body.data).toHaveLength(3);

    // An unrelated outsider only sees the global one.
    const outsiderEvents = await request(app).get('/api/v1/events/me').set('Cookie', outsiderCookies);
    expect(outsiderEvents.body.data.map((e: { title: string }) => e.title)).toEqual(['Global Assembly']);

    // Outsider cannot delete an event they didn't create.
    const forbiddenDelete = await request(app)
      .delete(`/api/v1/events/${courseEventId}`)
      .set('Cookie', outsiderCookies);
    expect(forbiddenDelete.status).toBe(403);

    // The creator can delete their own event.
    const okDelete = await request(app)
      .delete(`/api/v1/events/${courseEventId}`)
      .set('Cookie', teacherCookies);
    expect(okDelete.status).toBe(200);

    const afterDelete = await request(app).get('/api/v1/events/me').set('Cookie', studentCookies);
    expect(afterDelete.body.data.map((e: { title: string }) => e.title)).toEqual(['Global Assembly', 'Class trip']);
  });

  it('rejects a student trying to create an event', async () => {
    const student = await createStudentUser();
    const studentCookies = await signInAs(student.email, 'student');
    const res = await request(app)
      .post('/api/v1/events')
      .set('Cookie', studentCookies)
      .send({ title: 'Nope', startAt: new Date(Date.now() + 3600_000).toISOString(), audience: 'global' });
    expect(res.status).toBe(403);
  });
});
