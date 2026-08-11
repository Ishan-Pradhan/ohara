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
const { ClassMembership } = await import('../../src/models/classMemberships.model.js');
const {
  createSection,
  createStudentUser,
  createTeacherUser,
  createAcademicYear,
  createProgram,
  createClass,
  createCourse,
  createEnrollment,
  createBatch,
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
      .send({ studentId: 'x', sectionId: 'y', batchId: 'z' });
    expect(res.status).toBe(401);
  });

  it('rejects a non-admin caller with 403', async () => {
    const cookies = await signInAs('teacher@example.com', 'teacher');
    const section = await createSection();
    const student = await createStudentUser();
    const batch = await createBatch();
    const res = await request(app)
      .post(CLASS_MEMBERSHIPS)
      .set('Cookie', cookies)
      .send({ studentId: student.id, sectionId: section.id, batchId: batch.id });
    expect(res.status).toBe(403);
  });

  it('rejects a non-existent studentId with 404', async () => {
    const cookies = await signInAs('admin@example.com', 'admin');
    const section = await createSection();
    const batch = await createBatch();
    const res = await request(app)
      .post(CLASS_MEMBERSHIPS)
      .set('Cookie', cookies)
      .send({
        studentId: '00000000-0000-0000-0000-000000000000',
        sectionId: section.id,
        batchId: batch.id,
      });
    expect(res.status).toBe(404);
  });

  it('rejects a studentId that is not a student with 400', async () => {
    const cookies = await signInAs('admin@example.com', 'admin');
    const section = await createSection();
    const teacher = await createTeacherUser();
    const batch = await createBatch();
    const res = await request(app)
      .post(CLASS_MEMBERSHIPS)
      .set('Cookie', cookies)
      .send({ studentId: teacher.id, sectionId: section.id, batchId: batch.id });
    expect(res.status).toBe(400);
  });

  it('rejects a non-existent sectionId with 404', async () => {
    const cookies = await signInAs('admin@example.com', 'admin');
    const student = await createStudentUser();
    const batch = await createBatch();
    const res = await request(app)
      .post(CLASS_MEMBERSHIPS)
      .set('Cookie', cookies)
      .send({
        studentId: student.id,
        sectionId: '00000000-0000-0000-0000-000000000000',
        batchId: batch.id,
      });
    expect(res.status).toBe(404);
  });

  it('places a student into a section as admin', async () => {
    const cookies = await signInAs('admin@example.com', 'admin');
    const program = await createProgram();
    const cls = await createClass({ programId: program.id });
    const section = await createSection({ classId: cls.id });
    const batch = await createBatch({ programId: program.id });
    const student = await createStudentUser();
    const res = await request(app)
      .post(CLASS_MEMBERSHIPS)
      .set('Cookie', cookies)
      .send({ studentId: student.id, sectionId: section.id, batchId: batch.id });

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      studentId: student.id,
      batchId: batch.id,
      sectionId: section.id,
      academicYearId: section.academicYearId,
      outcome: 'enrolled',
    });
  });

  it('rejects placing the same student twice in the same academic year with 400', async () => {
    const cookies = await signInAs('admin@example.com', 'admin');
    const year = await createAcademicYear();

    const programA = await createProgram();
    const clsA = await createClass({ programId: programA.id });
    const sectionA = await createSection({ classId: clsA.id, academicYearId: year.id });
    const batchA = await createBatch({ programId: programA.id });

    const programB = await createProgram();
    const clsB = await createClass({ programId: programB.id });
    const sectionB = await createSection({
      classId: clsB.id,
      academicYearId: year.id,
      name: 'B',
    });
    const batchB = await createBatch({ programId: programB.id });

    const student = await createStudentUser();

    await request(app)
      .post(CLASS_MEMBERSHIPS)
      .set('Cookie', cookies)
      .send({ studentId: student.id, sectionId: sectionA.id, batchId: batchA.id });

    const res = await request(app)
      .post(CLASS_MEMBERSHIPS)
      .set('Cookie', cookies)
      .send({ studentId: student.id, sectionId: sectionB.id, batchId: batchB.id });

    expect(res.status).toBe(400);
  });

  it('rejects placement when the batch belongs to a different program', async () => {
    const cookies = await signInAs('admin@example.com', 'admin');
    const program = await createProgram();
    const cls = await createClass({ programId: program.id });
    const section = await createSection({ classId: cls.id });
    const student = await createStudentUser();
    const otherProgramBatch = await createBatch();

    const res = await request(app)
      .post(CLASS_MEMBERSHIPS)
      .set('Cookie', cookies)
      .send({ studentId: student.id, sectionId: section.id, batchId: otherProgramBatch.id });

    expect(res.status).toBe(400);
  });

  it('rejects placement into a section that is already at capacity', async () => {
    const cookies = await signInAs('admin@example.com', 'admin');
    const program = await createProgram();
    const cls = await createClass({ programId: program.id });
    const section = await createSection({ classId: cls.id, capacity: 1 });
    const batch = await createBatch({ programId: program.id });
    const firstStudent = await createStudentUser();
    const secondStudent = await createStudentUser();

    const firstRes = await request(app)
      .post(CLASS_MEMBERSHIPS)
      .set('Cookie', cookies)
      .send({ studentId: firstStudent.id, sectionId: section.id, batchId: batch.id });
    expect(firstRes.status).toBe(201);

    const secondRes = await request(app)
      .post(CLASS_MEMBERSHIPS)
      .set('Cookie', cookies)
      .send({ studentId: secondStudent.id, sectionId: section.id, batchId: batch.id });
    expect(secondRes.status).toBe(400);
    expect(secondRes.body.message).toMatch(/at capacity/i);
  });
});

describe('GET /admin/class-memberships', () => {
  it('filters by studentId', async () => {
    const cookies = await signInAs('admin@example.com', 'admin');
    const program = await createProgram();
    const cls = await createClass({ programId: program.id });
    const section = await createSection({ classId: cls.id });
    const batch = await createBatch({ programId: program.id });
    const studentA = await createStudentUser();
    const studentB = await createStudentUser();

    await request(app)
      .post(CLASS_MEMBERSHIPS)
      .set('Cookie', cookies)
      .send({ studentId: studentA.id, sectionId: section.id, batchId: batch.id });
    await request(app)
      .post(CLASS_MEMBERSHIPS)
      .set('Cookie', cookies)
      .send({ studentId: studentB.id, sectionId: section.id, batchId: batch.id });

    const res = await request(app)
      .get(CLASS_MEMBERSHIPS)
      .query({ studentId: studentA.id })
      .set('Cookie', cookies);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].studentId).toBe(studentA.id);
  });
});

const ENROLLMENTS = '/api/v1/admin/enrollments';

describe('POST /admin/enrollments', () => {
  it('rejects an unauthenticated caller with 401', async () => {
    const res = await request(app)
      .post(ENROLLMENTS)
      .send({ studentId: 'x', courseId: 'y' });
    expect(res.status).toBe(401);
  });

  it('rejects a non-admin caller with 403', async () => {
    const cookies = await signInAs('teacher@example.com', 'teacher');
    const course = await createCourse();
    const student = await createStudentUser();
    const res = await request(app)
      .post(ENROLLMENTS)
      .set('Cookie', cookies)
      .send({ studentId: student.id, courseId: course.id });
    expect(res.status).toBe(403);
  });

  it('rejects a student with no current-year placement with 404', async () => {
    const cookies = await signInAs('admin@example.com', 'admin');
    await createAcademicYear({ isCurrent: true });
    const course = await createCourse();
    const student = await createStudentUser();

    const res = await request(app)
      .post(ENROLLMENTS)
      .set('Cookie', cookies)
      .send({ studentId: student.id, courseId: course.id });

    expect(res.status).toBe(404);
  });

  it('enrolls a placed student in a course', async () => {
    const cookies = await signInAs('admin@example.com', 'admin');
    const program = await createProgram({ institutionType: 'college' });
    const cls = await createClass({ programId: program.id });
    const year = await createAcademicYear({ isCurrent: true });
    const section = await createSection({ classId: cls.id, academicYearId: year.id });
    // Elective so placement doesn't auto-enroll it — this test is about the
    // explicit enrollment endpoint, not auto-enroll.
    const course = await createCourse({ classId: cls.id, courseType: 'elective' });
    const batch = await createBatch({ programId: program.id });
    const student = await createStudentUser();

    await request(app)
      .post(CLASS_MEMBERSHIPS)
      .set('Cookie', cookies)
      .send({ studentId: student.id, sectionId: section.id, batchId: batch.id });

    const res = await request(app)
      .post(ENROLLMENTS)
      .set('Cookie', cookies)
      .send({ studentId: student.id, courseId: course.id });

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      studentId: student.id,
      courseId: course.id,
      academicYearId: year.id,
      status: 'active',
    });
  });

  it('rejects enrolling the same student in the same course twice with 400', async () => {
    const cookies = await signInAs('admin@example.com', 'admin');
    const program = await createProgram({ institutionType: 'college' });
    const cls = await createClass({ programId: program.id });
    const year = await createAcademicYear({ isCurrent: true });
    const section = await createSection({ classId: cls.id, academicYearId: year.id });
    const course = await createCourse({ classId: cls.id, courseType: 'elective' });
    const batch = await createBatch({ programId: program.id });
    const student = await createStudentUser();

    await request(app)
      .post(CLASS_MEMBERSHIPS)
      .set('Cookie', cookies)
      .send({ studentId: student.id, sectionId: section.id, batchId: batch.id });
    await request(app)
      .post(ENROLLMENTS)
      .set('Cookie', cookies)
      .send({ studentId: student.id, courseId: course.id });

    const res = await request(app)
      .post(ENROLLMENTS)
      .set('Cookie', cookies)
      .send({ studentId: student.id, courseId: course.id });

    expect(res.status).toBe(400);
  });
});

describe('GET /admin/enrollments', () => {
  it('filters by studentId', async () => {
    const cookies = await signInAs('admin@example.com', 'admin');
    const studentA = await createStudentUser();
    const studentB = await createStudentUser();
    await createEnrollment({ studentId: studentA.id });
    await createEnrollment({ studentId: studentB.id });

    const res = await request(app)
      .get(ENROLLMENTS)
      .query({ studentId: studentA.id })
      .set('Cookie', cookies);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].studentId).toBe(studentA.id);
  });
});

describe('POST /admin/class-memberships — auto-enroll behavior', () => {
  it('auto-enrolls the student in every course of the class for a school program', async () => {
    const cookies = await signInAs('admin@example.com', 'admin');
    const program = await createProgram({ institutionType: 'school' });
    const cls = await createClass({ programId: program.id });
    const year = await createAcademicYear();
    const section = await createSection({ classId: cls.id, academicYearId: year.id });
    await createCourse({ classId: cls.id, title: 'Physics', code: `PHYS-${Date.now()}` });
    await createCourse({ classId: cls.id, title: 'Chemistry', code: `CHEM-${Date.now()}` });
    const batch = await createBatch({ programId: program.id });
    const student = await createStudentUser();

    await request(app)
      .post(CLASS_MEMBERSHIPS)
      .set('Cookie', cookies)
      .send({ studentId: student.id, sectionId: section.id, batchId: batch.id });

    const res = await request(app)
      .get(ENROLLMENTS)
      .query({ studentId: student.id })
      .set('Cookie', cookies);

    expect(res.body.data).toHaveLength(2);
  });

  it('auto-enrolls compulsory courses but not electives, for a college program', async () => {
    const cookies = await signInAs('admin@example.com', 'admin');
    const program = await createProgram({ institutionType: 'college' });
    const cls = await createClass({ programId: program.id });
    const year = await createAcademicYear();
    const section = await createSection({ classId: cls.id, academicYearId: year.id });
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
    const batch = await createBatch({ programId: program.id });
    const student = await createStudentUser();

    const res = await request(app)
      .post(CLASS_MEMBERSHIPS)
      .set('Cookie', cookies)
      .send({ studentId: student.id, sectionId: section.id, batchId: batch.id });

    expect(res.status).toBe(201);

    const enrollments = await request(app)
      .get(ENROLLMENTS)
      .query({ studentId: student.id })
      .set('Cookie', cookies);

    const enrolledCourseIds = enrollments.body.data.map((e: { courseId: string }) => e.courseId);
    expect(enrolledCourseIds).toContain(compulsoryCourse.id);
    expect(enrolledCourseIds).not.toContain(electiveCourse.id);
  });
});

describe('POST /admin/sections/:sectionId/promote and GET /admin/sections/:sectionId/roster', () => {
  it('bulk-promotes a section, applying an override for one student', async () => {
    const cookies = await signInAs('admin@example.com', 'admin');
    const program = await createProgram();
    const classA = await createClass({ programId: program.id, orderIndex: 1 });
    const classB = await createClass({ programId: program.id, orderIndex: 2 });
    const oldYear = await createAcademicYear();
    const newYear = await createAcademicYear();
    const section = await createSection({ classId: classA.id, academicYearId: oldYear.id });
    const nextSection = await createSection({
      classId: classB.id,
      academicYearId: newYear.id,
      name: 'B',
    });
    // A same-class ("retained") target section — must be a *different*
    // academic year from `section`, since ClassMemberships has a unique
    // (studentId, academicYearId) index: promote() always inserts the new
    // membership row before closing out the old one, so a retained target
    // sharing the student's current academic year would collide with their
    // own still-open row.
    const retainedSection = await createSection({
      classId: classA.id,
      academicYearId: newYear.id,
      name: 'C',
    });
    const batch = await createBatch({ programId: program.id });
    const studentA = await createStudentUser();
    const studentB = await createStudentUser();

    await request(app)
      .post(CLASS_MEMBERSHIPS)
      .set('Cookie', cookies)
      .send({ studentId: studentA.id, sectionId: section.id, batchId: batch.id });
    await request(app)
      .post(CLASS_MEMBERSHIPS)
      .set('Cookie', cookies)
      .send({ studentId: studentB.id, sectionId: section.id, batchId: batch.id });

    const res = await request(app)
      .post(`/api/v1/admin/sections/${section.id}/promote`)
      .set('Cookie', cookies)
      .send({
        defaultTargetSectionId: nextSection.id,
        overrides: [
          { studentId: studentB.id, outcome: 'retained', targetSectionId: retainedSection.id },
        ],
      });

    expect(res.status).toBe(200);
    const byStudent = Object.fromEntries(
      res.body.data.map((r: { studentId: string }) => [r.studentId, r]),
    );
    expect(byStudent[studentA.id].status).toBe('ok');
    expect(byStudent[studentA.id].membership.sectionId).toBe(nextSection.id);
    expect(byStudent[studentB.id].status).toBe('ok');
    expect(byStudent[studentB.id].membership.sectionId).toBe(retainedSection.id);
  });

  it('reports a per-student failure without aborting the rest of the batch', async () => {
    const cookies = await signInAs('admin@example.com', 'admin');
    const program = await createProgram();
    const classA = await createClass({ programId: program.id, orderIndex: 1 });
    const classB = await createClass({ programId: program.id, orderIndex: 2 });
    const oldYear = await createAcademicYear();
    const newYear = await createAcademicYear();
    const section = await createSection({ classId: classA.id, academicYearId: oldYear.id });
    const nextSection = await createSection({
      classId: classB.id,
      academicYearId: newYear.id,
      name: 'B',
    });
    const batch = await createBatch({ programId: program.id });
    const alreadyPromotedStudent = await createStudentUser();
    const stillCurrentStudent = await createStudentUser();

    const alreadyPromotedPlacement = await request(app)
      .post(CLASS_MEMBERSHIPS)
      .set('Cookie', cookies)
      .send({ studentId: alreadyPromotedStudent.id, sectionId: section.id, batchId: batch.id });
    const stillCurrentPlacement = await request(app)
      .post(CLASS_MEMBERSHIPS)
      .set('Cookie', cookies)
      .send({ studentId: stillCurrentStudent.id, sectionId: section.id, batchId: batch.id });

    // Simulate a stale-roster race: this membership row already has
    // promotedToId set (as if promoted via the single-student route a moment
    // ago) while its outcome column is still 'enrolled', so it's still
    // returned by findBySectionWithStudents. applyOutcome's "already
    // advanced" guard must catch it per-student without aborting the batch.
    await ClassMembership.update(
      { promotedToId: stillCurrentPlacement.body.data.id },
      { where: { id: alreadyPromotedPlacement.body.data.id } },
    );

    const res = await request(app)
      .post(`/api/v1/admin/sections/${section.id}/promote`)
      .set('Cookie', cookies)
      .send({ defaultTargetSectionId: nextSection.id, overrides: [] });

    expect(res.status).toBe(200);
    const byStudent = Object.fromEntries(
      res.body.data.map((r: { studentId: string }) => [r.studentId, r]),
    );
    expect(byStudent[alreadyPromotedStudent.id].status).toBe('error');
    expect(byStudent[stillCurrentStudent.id].status).toBe('ok');
  });

  it('GET /admin/sections/:sectionId/roster returns the active roster', async () => {
    const cookies = await signInAs('admin@example.com', 'admin');
    const program = await createProgram();
    const cls = await createClass({ programId: program.id });
    const section = await createSection({ classId: cls.id });
    const batch = await createBatch({ programId: program.id });
    const student = await createStudentUser();

    await request(app)
      .post(CLASS_MEMBERSHIPS)
      .set('Cookie', cookies)
      .send({ studentId: student.id, sectionId: section.id, batchId: batch.id });

    const res = await request(app)
      .get(`/api/v1/admin/sections/${section.id}/roster`)
      .set('Cookie', cookies);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.data[0]).toHaveProperty('membershipId');
    expect(res.body.data[0].student).toHaveProperty('name');
  });
});
