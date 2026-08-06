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
  createCourse,
  createTeacherUser,
  createStudentUser,
  createEnrollment,
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

const setupCourseWithTeacherAndStudent = async () => {
  const course = await createCourse();
  const teacher = await createTeacherUser({ email: `teacher-${Date.now()}@example.com` });
  await courseTeacherRepository.assign({ teacherId: teacher.id, courseId: course.id });
  const student = await createStudentUser({ email: `student-${Date.now()}@example.com` });
  await createEnrollment({ studentId: student.id, courseId: course.id });

  const teacherCookies = await signInAs(teacher.email, 'teacher');
  const studentCookies = await signInAs(student.email, 'student');
  return { course, teacher, student, teacherCookies, studentCookies };
};

beforeEach(async () => {
  await truncateAll();
});

afterAll(async () => {
  await closeDb();
});

describe('Attendance', () => {
  it('rejects a student trying to take attendance', async () => {
    const { course, studentCookies, student } = await setupCourseWithTeacherAndStudent();
    const res = await request(app)
      .post(`/api/v1/courses/${course.id}/attendance/sessions`)
      .set('Cookie', studentCookies)
      .send({ sessionDate: '2026-08-06', records: [{ studentId: student.id, status: 'present' }] });
    expect(res.status).toBe(403);
  });

  it('rejects a record for a student who is not actively enrolled', async () => {
    const { course, teacherCookies } = await setupCourseWithTeacherAndStudent();
    const outsider = await createStudentUser({ email: `outsider-${Date.now()}@example.com` });
    const res = await request(app)
      .post(`/api/v1/courses/${course.id}/attendance/sessions`)
      .set('Cookie', teacherCookies)
      .send({ sessionDate: '2026-08-06', records: [{ studentId: outsider.id, status: 'present' }] });
    expect(res.status).toBe(400);
  });

  it('records a session, computes the percentage, lets a teacher correct it, and exposes the same number to the student', async () => {
    const { course, teacherCookies, studentCookies, student } = await setupCourseWithTeacherAndStudent();

    // Session 1: present. Session 2: absent. -> 1/2 = 50%.
    const session1 = await request(app)
      .post(`/api/v1/courses/${course.id}/attendance/sessions`)
      .set('Cookie', teacherCookies)
      .send({ sessionDate: '2026-08-01', records: [{ studentId: student.id, status: 'present' }] });
    expect(session1.status).toBe(201);
    expect(session1.body.data.records).toEqual([
      { studentId: student.id, studentName: student.name, status: 'present' },
    ]);

    const session2 = await request(app)
      .post(`/api/v1/courses/${course.id}/attendance/sessions`)
      .set('Cookie', teacherCookies)
      .send({ sessionDate: '2026-08-02', records: [{ studentId: student.id, status: 'absent' }] });
    expect(session2.status).toBe(201);
    const session2Id = session2.body.data.id;

    const listRes = await request(app)
      .get(`/api/v1/courses/${course.id}/attendance/sessions`)
      .set('Cookie', teacherCookies);
    expect(listRes.body.data).toHaveLength(2);

    let summaryRes = await request(app)
      .get(`/api/v1/courses/${course.id}/attendance/summary`)
      .set('Cookie', teacherCookies);
    expect(summaryRes.body.data).toEqual([
      { studentId: student.id, studentName: student.name, total: 2, present: 1, absent: 1, late: 0, percentage: 50 },
    ]);

    let myRes = await request(app)
      .get(`/api/v1/courses/${course.id}/attendance/me`)
      .set('Cookie', studentCookies);
    expect(myRes.body.data).toEqual({ total: 2, present: 1, absent: 1, late: 0, percentage: 50 });

    // Teacher corrects session 2 from absent -> late. -> both sessions now count as attended = 100%.
    const patchRes = await request(app)
      .patch(`/api/v1/courses/${course.id}/attendance/sessions/${session2Id}`)
      .set('Cookie', teacherCookies)
      .send({ records: [{ studentId: student.id, status: 'late' }] });
    expect(patchRes.status).toBe(200);
    expect(patchRes.body.data.records[0].status).toBe('late');

    summaryRes = await request(app)
      .get(`/api/v1/courses/${course.id}/attendance/summary`)
      .set('Cookie', teacherCookies);
    expect(summaryRes.body.data[0]).toEqual({
      studentId: student.id,
      studentName: student.name,
      total: 2,
      present: 1,
      absent: 0,
      late: 1,
      percentage: 100,
    });

    myRes = await request(app).get(`/api/v1/courses/${course.id}/attendance/me`).set('Cookie', studentCookies);
    expect(myRes.body.data.percentage).toBe(100);

    // Delete session 2 -> back down to a single present session = 100% still, but total drops to 1.
    const deleteRes = await request(app)
      .delete(`/api/v1/courses/${course.id}/attendance/sessions/${session2Id}`)
      .set('Cookie', teacherCookies);
    expect(deleteRes.status).toBe(200);

    summaryRes = await request(app)
      .get(`/api/v1/courses/${course.id}/attendance/summary`)
      .set('Cookie', teacherCookies);
    expect(summaryRes.body.data[0].total).toBe(1);
  });

  it('reports null percentage for a student with no sessions yet', async () => {
    const { course, studentCookies } = await setupCourseWithTeacherAndStudent();
    const res = await request(app)
      .get(`/api/v1/courses/${course.id}/attendance/me`)
      .set('Cookie', studentCookies);
    expect(res.body.data).toEqual({ total: 0, present: 0, absent: 0, late: 0, percentage: null });
  });
});
