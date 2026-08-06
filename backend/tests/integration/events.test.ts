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

describe('Events (academic calendar)', () => {
  it('scopes creation and relevance across global/institution_type/program/class, and enforces delete ownership', async () => {
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

    // A school-scoped teacher/student pair has no overlap with the college program above.
    const schoolProgram = await createProgram({ institutionType: 'school' });
    const outsiderTeacher = await createTeacherUser({ email: `outsider-${Date.now()}@example.com` });
    const outsiderCourse = await createCourse({
      classId: (await createClass({ programId: schoolProgram.id })).id,
      title: 'Outsider course',
    });
    await courseTeacherRepository.assign({ teacherId: outsiderTeacher.id, courseId: outsiderCourse.id });
    const outsiderCookies = await signInAs(outsiderTeacher.email, 'teacher');

    // Teacher is rejected trying to create a program-scoped event.
    const rejected = await request(app)
      .post('/api/v1/events')
      .set('Cookie', teacherCookies)
      .send({
        title: 'Bad',
        type: 'event',
        startAt: new Date(Date.now() + 3600_000).toISOString(),
        allDay: false,
        audience: 'program',
        programId: program.id,
      });
    expect(rejected.status).toBe(403);

    // Admin creates a global holiday.
    const globalRes = await request(app)
      .post('/api/v1/events')
      .set('Cookie', adminCookies)
      .send({
        title: 'Winter Break',
        type: 'holiday',
        startAt: new Date(Date.now() + 3600_000).toISOString(),
        allDay: true,
        audience: 'global',
      });
    expect(globalRes.status).toBe(201);

    // Admin creates a college-wide exam period (institution_type-scoped).
    const collegeExamRes = await request(app)
      .post('/api/v1/events')
      .set('Cookie', adminCookies)
      .send({
        title: 'College Finals',
        type: 'exam',
        startAt: new Date(Date.now() + 5400_000).toISOString(),
        allDay: false,
        audience: 'institution_type',
        institutionType: 'college',
      });
    expect(collegeExamRes.status).toBe(201);

    // Teacher creates a class-scoped event for their own class.
    const classEventRes = await request(app)
      .post('/api/v1/events')
      .set('Cookie', teacherCookies)
      .send({
        title: 'Class trip',
        type: 'event',
        startAt: new Date(Date.now() + 10800_000).toISOString(),
        allDay: false,
        audience: 'class',
        classId: cls.id,
      });
    expect(classEventRes.status).toBe(201);
    const classEventId = classEventRes.body.data.id;

    // Student sees all 3 (global + college institution_type + their class), sorted soonest-first.
    const studentEvents = await request(app).get('/api/v1/events/me').set('Cookie', studentCookies);
    expect(studentEvents.body.data.map((e: { title: string }) => e.title)).toEqual([
      'Winter Break',
      'College Finals',
      'Class trip',
    ]);

    // The teacher who created the class event also sees all 3.
    const teacherEvents = await request(app).get('/api/v1/events/me').set('Cookie', teacherCookies);
    expect(teacherEvents.body.data).toHaveLength(3);

    // A school-scoped outsider only sees the global holiday — not the college exam or the class trip.
    const outsiderEvents = await request(app).get('/api/v1/events/me').set('Cookie', outsiderCookies);
    expect(outsiderEvents.body.data.map((e: { title: string }) => e.title)).toEqual(['Winter Break']);

    // Outsider cannot delete an event they didn't create.
    const forbiddenDelete = await request(app)
      .delete(`/api/v1/events/${classEventId}`)
      .set('Cookie', outsiderCookies);
    expect(forbiddenDelete.status).toBe(403);

    // The creator can delete their own event.
    const okDelete = await request(app).delete(`/api/v1/events/${classEventId}`).set('Cookie', teacherCookies);
    expect(okDelete.status).toBe(200);

    const afterDelete = await request(app).get('/api/v1/events/me').set('Cookie', studentCookies);
    expect(afterDelete.body.data.map((e: { title: string }) => e.title)).toEqual(['Winter Break', 'College Finals']);
  });

  it('rejects a student trying to create an event', async () => {
    const student = await createStudentUser();
    const studentCookies = await signInAs(student.email, 'student');
    const res = await request(app)
      .post('/api/v1/events')
      .set('Cookie', studentCookies)
      .send({
        title: 'Nope',
        type: 'event',
        startAt: new Date(Date.now() + 3600_000).toISOString(),
        allDay: false,
        audience: 'global',
      });
    expect(res.status).toBe(403);
  });
});

describe('Admin birthday calendar', () => {
  it('sets a birthday for a teacher and a student, and surfaces both to the admin only', async () => {
    const adminCookies = await signInAs('admin@example.com', 'admin');
    const teacher = await createTeacherUser({ email: `bday-teacher-${Date.now()}@example.com` });
    const student = await createStudentUser({ email: `bday-student-${Date.now()}@example.com` });
    const teacherCookies = await signInAs(teacher.email, 'teacher');

    const now = new Date();
    const soon = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 3);
    const dob = `1995-${String(soon.getMonth() + 1).padStart(2, '0')}-${String(soon.getDate()).padStart(2, '0')}`;

    const teacherDobRes = await request(app)
      .patch(`/api/v1/admin/users/${teacher.id}/date-of-birth`)
      .set('Cookie', adminCookies)
      .send({ dateOfBirth: dob });
    expect(teacherDobRes.status).toBe(200);

    const studentDobRes = await request(app)
      .patch(`/api/v1/admin/users/${student.id}/date-of-birth`)
      .set('Cookie', adminCookies)
      .send({ dateOfBirth: dob });
    expect(studentDobRes.status).toBe(200);

    // Non-admin can't set another user's birthday.
    const forbidden = await request(app)
      .patch(`/api/v1/admin/users/${student.id}/date-of-birth`)
      .set('Cookie', teacherCookies)
      .send({ dateOfBirth: dob });
    expect(forbidden.status).toBe(403);

    const adminEvents = await request(app)
      .get(`/api/v1/events/me?from=${now.toISOString()}&to=${new Date(now.getTime() + 7 * 86400_000).toISOString()}`)
      .set('Cookie', adminCookies);
    const birthdayTitles = adminEvents.body.data
      .filter((e: { type: string }) => e.type === 'birthday')
      .map((e: { title: string }) => e.title)
      .sort();
    expect(birthdayTitles).toEqual([`${student.name}'s birthday`, `${teacher.name}'s birthday`]);

    // A non-admin never sees birthdays, even in the same date range.
    const teacherEvents = await request(app)
      .get(`/api/v1/events/me?from=${now.toISOString()}&to=${new Date(now.getTime() + 7 * 86400_000).toISOString()}`)
      .set('Cookie', teacherCookies);
    expect(teacherEvents.body.data.some((e: { type: string }) => e.type === 'birthday')).toBe(false);
  });
});
