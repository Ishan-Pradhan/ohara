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
  createClass,
  createAcademicYear,
  createSection,
  createBatch,
  createCourse,
  createTeacherUser,
  createStudentUser,
} = await import('../helpers/institution.js');
const { courseTeacherRepository } = await import(
  '../../src/repositories/courseTeachers.repository.js'
);
const { classMembershipRepository } = await import(
  '../../src/repositories/classMemberships.repository.js'
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

/** A course taught to one section, with one student both enrolled in the
 * course and currently placed in that section — the minimum needed for a
 * valid attendance roster. */
const setupCourseWithTeacherAndStudent = async () => {
  const cls = await createClass();
  const academicYear = await createAcademicYear();
  const batch = await createBatch({ programId: cls.programId, startAcademicYearId: academicYear.id });
  const section = await createSection({ classId: cls.id, academicYearId: academicYear.id });
  const course = await createCourse({ classId: cls.id });
  const teacher = await createTeacherUser({ email: `teacher-${Date.now()}@example.com` });
  await courseTeacherRepository.assign({ teacherId: teacher.id, courseId: course.id });
  const student = await createStudentUser({ email: `student-${Date.now()}@example.com` });
  await classMembershipRepository.create(
    { studentId: student.id, sectionId: section.id, batchId: batch.id, academicYearId: academicYear.id },
    [course.id],
  );

  const teacherCookies = await signInAs(teacher.email, 'teacher');
  const studentCookies = await signInAs(student.email, 'student');
  return { course, section, cls, academicYear, batch, teacher, student, teacherCookies, studentCookies };
};

beforeEach(async () => {
  await truncateAll();
});

afterAll(async () => {
  await closeDb();
});

describe('Attendance', () => {
  it('rejects a student trying to take attendance', async () => {
    const { course, section, studentCookies, student } = await setupCourseWithTeacherAndStudent();
    const res = await request(app)
      .post(`/api/v1/courses/${course.id}/attendance/sessions`)
      .set('Cookie', studentCookies)
      .send({
        sectionId: section.id,
        sessionDate: '2026-08-06',
        records: [{ studentId: student.id, status: 'present' }],
      });
    expect(res.status).toBe(403);
  });

  it('lists every section of the course’s class for the take-attendance picker', async () => {
    const { course, section, cls, academicYear, teacherCookies } = await setupCourseWithTeacherAndStudent();
    const otherSection = await createSection({ classId: cls.id, academicYearId: academicYear.id, name: 'B' });

    const res = await request(app)
      .get(`/api/v1/courses/${course.id}/attendance/sections`)
      .set('Cookie', teacherCookies);
    expect(res.status).toBe(200);
    expect(new Set(res.body.data.map((s: { id: string }) => s.id))).toEqual(
      new Set([section.id, otherSection.id]),
    );
  });

  it('rejects a record for a student who is not enrolled + placed in that section', async () => {
    const { course, section, teacherCookies } = await setupCourseWithTeacherAndStudent();
    const outsider = await createStudentUser({ email: `outsider-${Date.now()}@example.com` });
    const res = await request(app)
      .post(`/api/v1/courses/${course.id}/attendance/sessions`)
      .set('Cookie', teacherCookies)
      .send({
        sectionId: section.id,
        sessionDate: '2026-08-06',
        records: [{ studentId: outsider.id, status: 'present' }],
      });
    expect(res.status).toBe(400);
  });

  it('scopes the roster and sessions to one section — a student in a different section of the same course never appears', async () => {
    const { course, section, cls, academicYear, batch, teacherCookies, student } =
      await setupCourseWithTeacherAndStudent();

    const otherSection = await createSection({ classId: cls.id, academicYearId: academicYear.id, name: 'B' });
    const otherStudent = await createStudentUser({ email: `other-section-${Date.now()}@example.com` });
    await classMembershipRepository.create(
      { studentId: otherStudent.id, sectionId: otherSection.id, batchId: batch.id, academicYearId: academicYear.id },
      [course.id],
    );

    const rosterRes = await request(app)
      .get(`/api/v1/courses/${course.id}/attendance/roster`)
      .query({ sectionId: section.id })
      .set('Cookie', teacherCookies);
    expect(rosterRes.body.data).toEqual([{ studentId: student.id, studentName: student.name }]);

    // Taking attendance for `section` and including the other section's student is rejected.
    const rejected = await request(app)
      .post(`/api/v1/courses/${course.id}/attendance/sessions`)
      .set('Cookie', teacherCookies)
      .send({
        sectionId: section.id,
        sessionDate: '2026-08-06',
        records: [
          { studentId: student.id, status: 'present' },
          { studentId: otherStudent.id, status: 'present' },
        ],
      });
    expect(rejected.status).toBe(400);

    // Taking it correctly for both sections independently works, and each stays scoped.
    await request(app)
      .post(`/api/v1/courses/${course.id}/attendance/sessions`)
      .set('Cookie', teacherCookies)
      .send({ sectionId: section.id, sessionDate: '2026-08-06', records: [{ studentId: student.id, status: 'present' }] });
    await request(app)
      .post(`/api/v1/courses/${course.id}/attendance/sessions`)
      .set('Cookie', teacherCookies)
      .send({ sectionId: otherSection.id, sessionDate: '2026-08-06', records: [{ studentId: otherStudent.id, status: 'absent' }] });

    const sessions = await request(app)
      .get(`/api/v1/courses/${course.id}/attendance/sessions`)
      .set('Cookie', teacherCookies);
    expect(sessions.body.data).toHaveLength(2);
    expect(new Set(sessions.body.data.map((s: { sectionId: string }) => s.sectionId))).toEqual(
      new Set([section.id, otherSection.id]),
    );

    // The course-wide summary still correctly attributes each student's own record only.
    const summary = await request(app)
      .get(`/api/v1/courses/${course.id}/attendance/summary`)
      .set('Cookie', teacherCookies);
    const byStudent = Object.fromEntries(
      summary.body.data.map((r: { studentId: string; present: number; absent: number }) => [r.studentId, r]),
    );
    expect(byStudent[student.id]).toMatchObject({ present: 1, absent: 0 });
    expect(byStudent[otherStudent.id]).toMatchObject({ present: 0, absent: 1 });
  });

  it('records a session, computes the percentage, lets a teacher correct it, and exposes the same number to the student', async () => {
    const { course, section, teacherCookies, studentCookies, student } = await setupCourseWithTeacherAndStudent();

    // Session 1: present. Session 2: absent. -> 1/2 = 50%.
    const session1 = await request(app)
      .post(`/api/v1/courses/${course.id}/attendance/sessions`)
      .set('Cookie', teacherCookies)
      .send({ sectionId: section.id, sessionDate: '2026-08-01', records: [{ studentId: student.id, status: 'present' }] });
    expect(session1.status).toBe(201);
    expect(session1.body.data.records).toEqual([
      { studentId: student.id, studentName: student.name, status: 'present' },
    ]);
    expect(session1.body.data.sectionId).toBe(section.id);

    const session2 = await request(app)
      .post(`/api/v1/courses/${course.id}/attendance/sessions`)
      .set('Cookie', teacherCookies)
      .send({ sectionId: section.id, sessionDate: '2026-08-02', records: [{ studentId: student.id, status: 'absent' }] });
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
