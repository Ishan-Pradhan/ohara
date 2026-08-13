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
  createCourse,
  createTeacherUser,
  createStudentUser,
  createEnrollment,
  createBatch,
} = await import('../helpers/institution.js');
const { courseTeacherRepository } = await import(
  '../../src/repositories/courseTeachers.repository.js'
);
const { classMembershipRepository } = await import(
  '../../src/repositories/classMemberships.repository.js'
);
const { studentProfileRepository } = await import(
  '../../src/repositories/studentProfiles.repository.js'
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

/** A teacher assigned to one course, with one student enrolled in it and
 * fully placed (program/class/section/batch) — the minimum shared context
 * every test in this file builds on. */
const setupTeacherWithPlacedStudent = async () => {
  const program = await createProgram({ name: 'Test Program' });
  const cls = await createClass({ programId: program.id, name: 'Semester 1' });
  const batch = await createBatch({ programId: program.id });
  const section = await createSection({ classId: cls.id, batchId: batch.id, name: 'A' });
  const course = await createCourse({ classId: cls.id, title: 'Software Engineering' });

  const teacher = await createTeacherUser({ email: `teacher-${Date.now()}@example.com` });
  await courseTeacherRepository.assign({ teacherId: teacher.id, courseId: course.id });

  const student = await createStudentUser({ email: `student-${Date.now()}@example.com` });
  await createEnrollment({ studentId: student.id, courseId: course.id, batchId: batch.id });
  await classMembershipRepository.create({
    studentId: student.id,
    sectionId: section.id,
    batchId: batch.id,
    classId: cls.id,
  });

  const teacherCookies = await signInAs(teacher.email, 'teacher');
  return { program, cls, section, batch, course, teacher, student, teacherCookies };
};

beforeEach(async () => {
  await truncateAll();
});

afterAll(async () => {
  await closeDb();
});

describe('GET /teacher/students', () => {
  it("lists a student the teacher shares a course with, annotated with program/class/section/batch", async () => {
    const { program, cls, section, batch, course, student, teacherCookies } =
      await setupTeacherWithPlacedStudent();

    const res = await request(app)
      .get('/api/v1/teacher/students')
      .set('Cookie', teacherCookies);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0]).toMatchObject({
      id: student.id,
      name: student.name,
      programId: program.id,
      programName: program.name,
      className: cls.name,
      sectionName: section.name,
      batchName: batch.name,
      courses: [{ id: course.id, title: course.title, code: course.code }],
    });
  });

  it('lists a student shared across two of the teacher\'s courses only once, with both courses listed', async () => {
    const { course, teacher, student, teacherCookies } = await setupTeacherWithPlacedStudent();
    const { createCourse: createCourseHelper } = await import('../helpers/institution.js');

    const secondCourse = await createCourseHelper({ classId: course.classId, title: 'Data Structures' });
    await courseTeacherRepository.assign({ teacherId: teacher.id, courseId: secondCourse.id });
    await createEnrollment({ studentId: student.id, courseId: secondCourse.id });

    const res = await request(app)
      .get('/api/v1/teacher/students')
      .set('Cookie', teacherCookies);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(new Set(res.body.data[0].courses.map((c: { id: string }) => c.id))).toEqual(
      new Set([course.id, secondCourse.id]),
    );
  });

  it('never lists a student who is not enrolled in any of this teacher\'s courses', async () => {
    const { teacherCookies } = await setupTeacherWithPlacedStudent();
    await createStudentUser({ email: `outsider-${Date.now()}@example.com` });

    const res = await request(app)
      .get('/api/v1/teacher/students')
      .set('Cookie', teacherCookies);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
  });

  it('rejects a student role', async () => {
    const studentCookies = await signInAs(`plainstudent-${Date.now()}@example.com`, 'student');
    const res = await request(app).get('/api/v1/teacher/students').set('Cookie', studentCookies);
    expect(res.status).toBe(403);
  });
});

describe('GET /teacher/students/:studentId', () => {
  it("returns the student's profile with per-shared-course grade/attendance and empty flags", async () => {
    const { course, student, teacherCookies } = await setupTeacherWithPlacedStudent();

    const res = await request(app)
      .get(`/api/v1/teacher/students/${student.id}`)
      .set('Cookie', teacherCookies);

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      id: student.id,
      courses: [
        {
          courseId: course.id,
          courseTitle: course.title,
          grade: { studentId: student.id, entries: [], totalScore: 0, totalMaxScore: 0, average: null },
          attendance: { total: 0, present: 0, absent: 0, late: 0, percentage: null },
        },
      ],
      flags: [],
    });
  });

  it("includes the student's KYC profile fields (or null if never provided)", async () => {
    const { student, teacherCookies } = await setupTeacherWithPlacedStudent();
    await studentProfileRepository.upsert(student.id, {
      parentName: 'Grace Hopper',
      parentPhone: '9800000001',
      address: '1 Compiler Lane',
      dateOfBirth: '2006-03-01',
      previousSchool: 'Vassar',
      studentPhone: '9811111112',
    });

    const res = await request(app)
      .get(`/api/v1/teacher/students/${student.id}`)
      .set('Cookie', teacherCookies);

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      dateOfBirth: '2006-03-01',
      address: '1 Compiler Lane',
      studentPhone: '9811111112',
      parentName: 'Grace Hopper',
      parentPhone: '9800000001',
      previousSchool: 'Vassar',
    });
  });

  it("403s for a student the teacher doesn't share any course with", async () => {
    const { teacherCookies } = await setupTeacherWithPlacedStudent();
    const outsider = await createStudentUser({ email: `outsider2-${Date.now()}@example.com` });

    const res = await request(app)
      .get(`/api/v1/teacher/students/${outsider.id}`)
      .set('Cookie', teacherCookies);

    expect(res.status).toBe(403);
  });

  it('404s for a non-existent student', async () => {
    const { teacherCookies } = await setupTeacherWithPlacedStudent();
    const res = await request(app)
      .get('/api/v1/teacher/students/00000000-0000-0000-0000-000000000000')
      .set('Cookie', teacherCookies);
    expect(res.status).toBe(404);
  });
});

describe('Teacher student notes', () => {
  it('creates and lists a note, private to the teacher who wrote it', async () => {
    const { course, student, teacherCookies } = await setupTeacherWithPlacedStudent();

    const createRes = await request(app)
      .post(`/api/v1/teacher/students/${student.id}/notes`)
      .set('Cookie', teacherCookies)
      .send({ content: 'Struggles with recursion, worth a follow-up.' });
    expect(createRes.status).toBe(201);
    expect(createRes.body.data.content).toBe('Struggles with recursion, worth a follow-up.');

    const listRes = await request(app)
      .get(`/api/v1/teacher/students/${student.id}/notes`)
      .set('Cookie', teacherCookies);
    expect(listRes.status).toBe(200);
    expect(listRes.body.data).toHaveLength(1);

    // A second teacher who also shares this student never sees the first
    // teacher's note — notes are private per-author, not shared.
    const secondTeacher = await createTeacherUser({ email: `teacher2-${Date.now()}@example.com` });
    await courseTeacherRepository.assign({ teacherId: secondTeacher.id, courseId: course.id });
    const secondTeacherCookies = await signInAs(secondTeacher.email, 'teacher');

    const otherListRes = await request(app)
      .get(`/api/v1/teacher/students/${student.id}/notes`)
      .set('Cookie', secondTeacherCookies);
    expect(otherListRes.status).toBe(200);
    expect(otherListRes.body.data).toEqual([]);
  });

  it('deletes a note the teacher owns, and rejects deleting one they don\'t', async () => {
    const { course, student, teacherCookies } = await setupTeacherWithPlacedStudent();

    const createRes = await request(app)
      .post(`/api/v1/teacher/students/${student.id}/notes`)
      .set('Cookie', teacherCookies)
      .send({ content: 'A note.' });
    const noteId = createRes.body.data.id;

    const secondTeacher = await createTeacherUser({ email: `teacher3-${Date.now()}@example.com` });
    await courseTeacherRepository.assign({ teacherId: secondTeacher.id, courseId: course.id });
    const secondTeacherCookies = await signInAs(secondTeacher.email, 'teacher');

    const rejected = await request(app)
      .delete(`/api/v1/teacher/students/${student.id}/notes/${noteId}`)
      .set('Cookie', secondTeacherCookies);
    expect(rejected.status).toBe(404);

    const deleted = await request(app)
      .delete(`/api/v1/teacher/students/${student.id}/notes/${noteId}`)
      .set('Cookie', teacherCookies);
    expect(deleted.status).toBe(200);

    const listRes = await request(app)
      .get(`/api/v1/teacher/students/${student.id}/notes`)
      .set('Cookie', teacherCookies);
    expect(listRes.body.data).toEqual([]);
  });

  it("403s creating a note for a student the teacher doesn't share a course with", async () => {
    const { teacherCookies } = await setupTeacherWithPlacedStudent();
    const outsider = await createStudentUser({ email: `outsider3-${Date.now()}@example.com` });

    const res = await request(app)
      .post(`/api/v1/teacher/students/${outsider.id}/notes`)
      .set('Cookie', teacherCookies)
      .send({ content: 'Should not be allowed.' });
    expect(res.status).toBe(403);
  });
});
