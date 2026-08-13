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
  createProgram,
  createClass,
  createCourse,
  createBatch,
} = await import('../helpers/institution.js');

const CLASS_MEMBERSHIPS = '/api/v1/admin/class-memberships';
const ADMIN_ENROLLMENTS = '/api/v1/admin/enrollments';
const ADMIN_COURSES = '/api/v1/admin/courses';
const PASSWORD = 'hunter2secret';

type Role = 'admin' | 'teacher' | 'student' | 'alumni';

/** Same pattern as tests/integration/placement.test.ts's local helper. */
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

/** Signs a student in via the real auth flow and returns both their login
 * cookies and their user id — self-enroll/drop routes derive the caller's
 * own studentId from the session, so route-level tests need a real login,
 * not just a bare user row (mirrors tutor.test.ts's signInEnrolledStudent). */
const signInStudent = async (email: string): Promise<{ cookies: string[]; id: string }> => {
  const cookies = await signInAs(email, 'student');
  const user = await User.findOne({ where: { email } });
  return { cookies, id: user!.id };
};

const unique = (prefix: string): string => `${prefix}-${Date.now()}-${Math.random()}`;

beforeEach(async () => {
  await truncateAll();
});

afterAll(async () => {
  await closeDb();
});

/** Places a freshly-signed-in student into a section of a fresh
 * program/class/year/batch, and creates a compulsory course, an elective
 * course in that same class, and an elective in a *different* class (for
 * cross-class-rejection tests). Returns everything a test needs. */
const setup = async () => {
  const adminCookies = await signInAs(unique('admin') + '@example.com', 'admin');

  const program = await createProgram();
  const currentClass = await createClass({ programId: program.id });
  const batch = await createBatch({ programId: program.id });
  const section = await createSection({ classId: currentClass.id, batchId: batch.id });

  const { cookies: studentCookie, id: studentId } = await signInStudent(
    unique('student') + '@example.com',
  );

  await request(app)
    .post(CLASS_MEMBERSHIPS)
    .set('Cookie', adminCookies)
    .send({ studentId, sectionId: section.id, batchId: batch.id });

  const compulsoryCourse = await createCourse({
    classId: currentClass.id,
    courseType: 'compulsory',
    title: 'Compulsory Course',
    code: unique('COMP'),
  });

  const elective = await createCourse({
    classId: currentClass.id,
    courseType: 'elective',
    title: 'Elective Course',
    code: unique('ELEC'),
  });

  // orderIndex 2: Classes has a unique (programId, orderIndex) index, and
  // currentClass above already took orderIndex 1 for this program.
  const otherClass = await createClass({ programId: program.id, orderIndex: 2 });
  const otherClassElective = await createCourse({
    classId: otherClass.id,
    courseType: 'elective',
    title: 'Other Class Elective',
    code: unique('OTHER'),
  });

  return {
    adminCookies,
    program,
    currentClass,
    section,
    batch,
    studentId,
    studentCookie,
    compulsoryCourse,
    elective,
    otherClass,
    otherClassElective,
  };
};

describe('POST /courses/:courseId/enroll', () => {
  it('a student self-enrolls in an elective in their current class', async () => {
    const { elective, studentCookie } = await setup();

    const res = await request(app)
      .post(`/api/v1/courses/${elective.id}/enroll`)
      .set('Cookie', studentCookie);

    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('active');
    expect(res.body.data.courseId).toBe(elective.id);
  });

  it('rejects an unauthenticated caller with 401', async () => {
    const { elective } = await setup();

    const res = await request(app).post(`/api/v1/courses/${elective.id}/enroll`);

    expect(res.status).toBe(401);
  });

  it('rejects self-enroll into a course from a different class', async () => {
    const { otherClassElective, studentCookie } = await setup();

    const res = await request(app)
      .post(`/api/v1/courses/${otherClassElective.id}/enroll`)
      .set('Cookie', studentCookie);

    expect(res.status).toBe(403);
  });

  it('rejects self-enroll into a compulsory course', async () => {
    const { compulsoryCourse, studentCookie } = await setup();

    const res = await request(app)
      .post(`/api/v1/courses/${compulsoryCourse.id}/enroll`)
      .set('Cookie', studentCookie);

    expect(res.status).toBe(400);
  });

  it('rejects self-enroll once the elective is at capacity', async () => {
    const { adminCookies, currentClass, section, batch, studentCookie } = await setup();

    const fullElectiveRes = await request(app)
      .post(ADMIN_COURSES)
      .set('Cookie', adminCookies)
      .send({
        classId: currentClass.id,
        title: 'Full Elective',
        code: unique('FULL'),
        courseType: 'elective',
        capacity: 1,
      });
    const fullElectiveId: string = fullElectiveRes.body.data.id;

    // Fill the single seat with another placed student, via the admin route.
    const fillerStudent = await createStudentUser();
    await request(app)
      .post(CLASS_MEMBERSHIPS)
      .set('Cookie', adminCookies)
      .send({ studentId: fillerStudent.id, sectionId: section.id, batchId: batch.id });
    await request(app)
      .post(ADMIN_ENROLLMENTS)
      .set('Cookie', adminCookies)
      .send({ studentId: fillerStudent.id, courseId: fullElectiveId });

    const res = await request(app)
      .post(`/api/v1/courses/${fullElectiveId}/enroll`)
      .set('Cookie', studentCookie);

    expect(res.status).toBe(400);
  });

  it('rejects enrolling twice while already active', async () => {
    const { elective, studentCookie } = await setup();

    await request(app).post(`/api/v1/courses/${elective.id}/enroll`).set('Cookie', studentCookie);
    const res = await request(app)
      .post(`/api/v1/courses/${elective.id}/enroll`)
      .set('Cookie', studentCookie);

    expect(res.status).toBe(400);
  });

  it('drops a self-enrolled elective, then allows re-enrolling by reactivating the same row', async () => {
    const { elective, studentCookie } = await setup();

    const firstEnrollRes = await request(app)
      .post(`/api/v1/courses/${elective.id}/enroll`)
      .set('Cookie', studentCookie);
    expect(firstEnrollRes.status).toBe(201);
    const enrollmentId: string = firstEnrollRes.body.data.id;

    const dropRes = await request(app)
      .delete(`/api/v1/courses/${elective.id}/enroll`)
      .set('Cookie', studentCookie);
    expect(dropRes.status).toBe(200);

    const reEnrollRes = await request(app)
      .post(`/api/v1/courses/${elective.id}/enroll`)
      .set('Cookie', studentCookie);
    expect(reEnrollRes.status).toBe(201);
    expect(reEnrollRes.body.data.status).toBe('active');
    // Reactivated the same (student, course, year) row rather than erroring
    // on the unique constraint or creating a duplicate.
    expect(reEnrollRes.body.data.id).toBe(enrollmentId);
  });
});

describe('DELETE /courses/:courseId/enroll', () => {
  it('rejects an unauthenticated caller with 401', async () => {
    const { elective } = await setup();

    const res = await request(app).delete(`/api/v1/courses/${elective.id}/enroll`);

    expect(res.status).toBe(401);
  });

  it('rejects dropping a compulsory course', async () => {
    const { compulsoryCourse, studentCookie } = await setup();

    const res = await request(app)
      .delete(`/api/v1/courses/${compulsoryCourse.id}/enroll`)
      .set('Cookie', studentCookie);

    expect(res.status).toBe(400);
  });

  it('rejects dropping a course from a different class', async () => {
    const { otherClassElective, studentCookie } = await setup();

    const res = await request(app)
      .delete(`/api/v1/courses/${otherClassElective.id}/enroll`)
      .set('Cookie', studentCookie);

    expect(res.status).toBe(403);
  });

  it('rejects dropping an elective the student is not enrolled in', async () => {
    const { elective, studentCookie } = await setup();

    const res = await request(app)
      .delete(`/api/v1/courses/${elective.id}/enroll`)
      .set('Cookie', studentCookie);

    expect(res.status).toBe(404);
  });
});

describe('GET /students/:studentId/electives', () => {
  it('lists only current-class electives with fill/capacity and own enrollment status', async () => {
    const { studentId, studentCookie, currentClass, elective, compulsoryCourse, otherClassElective } =
      await setup();

    await request(app).post(`/api/v1/courses/${elective.id}/enroll`).set('Cookie', studentCookie);

    const res = await request(app)
      .get(`/api/v1/students/${studentId}/electives`)
      .set('Cookie', studentCookie);

    expect(res.status).toBe(200);
    const data = res.body.data as {
      id: string;
      classId: string;
      isEnrolled: boolean;
      enrolledCount: number;
    }[];

    expect(data.every((c) => c.classId === currentClass.id)).toBe(true);
    const ids = data.map((c) => c.id);
    expect(ids).toContain(elective.id);
    expect(ids).not.toContain(compulsoryCourse.id);
    expect(ids).not.toContain(otherClassElective.id);

    const enrolled = data.find((c) => c.id === elective.id);
    expect(enrolled).toMatchObject({ isEnrolled: true, enrolledCount: 1 });
  });

  it('rejects a request for another student with 403', async () => {
    const { studentId } = await setup();
    const { cookies: otherStudentCookie } = await signInStudent(unique('other') + '@example.com');

    const res = await request(app)
      .get(`/api/v1/students/${studentId}/electives`)
      .set('Cookie', otherStudentCookie);

    expect(res.status).toBe(403);
  });

  it('rejects an unauthenticated caller with 401', async () => {
    const { studentId } = await setup();

    const res = await request(app).get(`/api/v1/students/${studentId}/electives`);

    expect(res.status).toBe(401);
  });
});
