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
  createStudentUser,
  createSection,
  createAcademicYear,
  createProgram,
  createClass,
  createCourse,
  createTeacherUser,
  createBatch,
} = await import('../helpers/institution.js');

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

describe('PATCH /admin/users/:id/archive', () => {
  it('rejects an unauthenticated caller with 401', async () => {
    const student = await createStudentUser();
    const res = await request(app).patch(`/api/v1/admin/users/${student.id}/archive`);
    expect(res.status).toBe(401);
  });

  it('rejects a non-admin caller with 403', async () => {
    const cookies = await signInAs('teacher@example.com', 'teacher');
    const student = await createStudentUser();
    const res = await request(app)
      .patch(`/api/v1/admin/users/${student.id}/archive`)
      .set('Cookie', cookies);
    expect(res.status).toBe(403);
  });

  it('rejects a non-existent user with 404', async () => {
    const cookies = await signInAs('admin@example.com', 'admin');
    const res = await request(app)
      .patch('/api/v1/admin/users/00000000-0000-0000-0000-000000000000/archive')
      .set('Cookie', cookies);
    expect(res.status).toBe(404);
  });

  it('archives a student as admin', async () => {
    const cookies = await signInAs('admin@example.com', 'admin');
    const student = await createStudentUser();
    const res = await request(app)
      .patch(`/api/v1/admin/users/${student.id}/archive`)
      .set('Cookie', cookies);

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('archived');
  });

  it('rejects archiving a non-student account with 400', async () => {
    const cookies = await signInAs('admin@example.com', 'admin');
    const teacher = await createTeacherUser();
    const res = await request(app)
      .patch(`/api/v1/admin/users/${teacher.id}/archive`)
      .set('Cookie', cookies);
    expect(res.status).toBe(400);
  });

  it('rejects a stale access token after the user is archived', async () => {
    const studentCookies = await signInAs('archived-student@example.com', 'student');
    const me = await request(app)
      .get('/api/v1/auth/current-user')
      .set('Cookie', studentCookies);
    expect(me.status).toBe(200);
    const studentId = me.body.data.id as string;

    const adminCookies = await signInAs('admin@example.com', 'admin');
    const archiveRes = await request(app)
      .patch(`/api/v1/admin/users/${studentId}/archive`)
      .set('Cookie', adminCookies);
    expect(archiveRes.status).toBe(200);

    const staleRes = await request(app)
      .get('/api/v1/auth/current-user')
      .set('Cookie', studentCookies);
    expect(staleRes.status).toBe(401);
  });
});

describe('PATCH /admin/users/:id/restore', () => {
  it('rejects an unauthenticated caller with 401', async () => {
    const student = await createStudentUser();
    const res = await request(app).patch(`/api/v1/admin/users/${student.id}/restore`);
    expect(res.status).toBe(401);
  });

  it('rejects a non-admin caller with 403', async () => {
    const cookies = await signInAs('teacher@example.com', 'teacher');
    const student = await createStudentUser();
    const res = await request(app)
      .patch(`/api/v1/admin/users/${student.id}/restore`)
      .set('Cookie', cookies);
    expect(res.status).toBe(403);
  });

  it('rejects a non-existent user with 404', async () => {
    const cookies = await signInAs('admin@example.com', 'admin');
    const res = await request(app)
      .patch('/api/v1/admin/users/00000000-0000-0000-0000-000000000000/restore')
      .set('Cookie', cookies);
    expect(res.status).toBe(404);
  });

  it('restores an archived student to active and clears deleted_at', async () => {
    const cookies = await signInAs('admin@example.com', 'admin');
    const student = await createStudentUser();
    await request(app)
      .patch(`/api/v1/admin/users/${student.id}/archive`)
      .set('Cookie', cookies);

    const res = await request(app)
      .patch(`/api/v1/admin/users/${student.id}/restore`)
      .set('Cookie', cookies);

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('active');

    const restored = await User.unscoped().findByPk(student.id);
    expect(restored?.status).toBe('active');
    expect(restored?.deletedAt).toBeNull();
  });

  it('restores an inactive student to active', async () => {
    const cookies = await signInAs('admin@example.com', 'admin');
    const student = await createStudentUser();
    await User.update({ status: 'inactive' }, { where: { id: student.id } });

    const res = await request(app)
      .patch(`/api/v1/admin/users/${student.id}/restore`)
      .set('Cookie', cookies);

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('active');
  });

  it('rejects restoring a graduated student with 400', async () => {
    const cookies = await signInAs('admin@example.com', 'admin');
    const student = await createStudentUser();
    await User.update({ status: 'graduated' }, { where: { id: student.id } });

    const res = await request(app)
      .patch(`/api/v1/admin/users/${student.id}/restore`)
      .set('Cookie', cookies);

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/graduated/i);
  });

  it('rejects restoring a non-student account with 400', async () => {
    const cookies = await signInAs('admin@example.com', 'admin');
    const teacher = await createTeacherUser();
    const res = await request(app)
      .patch(`/api/v1/admin/users/${teacher.id}/restore`)
      .set('Cookie', cookies);
    expect(res.status).toBe(400);
  });
});

describe('DELETE /admin/users/:id', () => {
  it('rejects a request without confirmHardDelete with 400', async () => {
    const cookies = await signInAs('admin@example.com', 'admin');
    const student = await createStudentUser();
    const res = await request(app)
      .delete(`/api/v1/admin/users/${student.id}`)
      .set('Cookie', cookies)
      .send({});
    expect(res.status).toBe(400);
  });

  it('rejects a non-existent user with 404', async () => {
    const cookies = await signInAs('admin@example.com', 'admin');
    const res = await request(app)
      .delete('/api/v1/admin/users/00000000-0000-0000-0000-000000000000')
      .set('Cookie', cookies)
      .send({ confirmHardDelete: true });
    expect(res.status).toBe(404);
  });

  it('permanently deletes a student with no academic records', async () => {
    const cookies = await signInAs('admin@example.com', 'admin');
    const student = await createStudentUser();
    const res = await request(app)
      .delete(`/api/v1/admin/users/${student.id}`)
      .set('Cookie', cookies)
      .send({ confirmHardDelete: true });

    expect(res.status).toBe(200);

    const check = await User.findByPk(student.id);
    expect(check).toBeNull();
  });

  it('rejects hard-deleting a student with existing class memberships with 409 and names the blockers', async () => {
    const cookies = await signInAs('admin@example.com', 'admin');
    const cls = await createClass();
    const section = await createSection({ classId: cls.id });
    const batch = await createBatch({ programId: cls.programId });
    const student = await createStudentUser();
    await request(app)
      .post('/api/v1/admin/class-memberships')
      .set('Cookie', cookies)
      .send({ studentId: student.id, sectionId: section.id, batchId: batch.id });

    const res = await request(app)
      .delete(`/api/v1/admin/users/${student.id}`)
      .set('Cookie', cookies)
      .send({ confirmHardDelete: true });

    expect(res.status).toBe(409);
    expect(res.body.errors.map((b: { entity: string }) => b.entity)).toContain('placement');
    expect(res.body.message).toMatch(/1 class placement/);
  });

  it('rejects hard-deleting a non-student account with 400', async () => {
    const cookies = await signInAs('admin@example.com', 'admin');
    const teacher = await createTeacherUser();
    const res = await request(app)
      .delete(`/api/v1/admin/users/${teacher.id}`)
      .set('Cookie', cookies)
      .send({ confirmHardDelete: true });
    expect(res.status).toBe(400);
  });
});

describe('POST /admin/class-memberships/:id/transfer', () => {
  it('rejects an unauthenticated caller with 401', async () => {
    const res = await request(app)
      .post('/api/v1/admin/class-memberships/00000000-0000-0000-0000-000000000000/transfer')
      .send({ targetSectionId: '00000000-0000-0000-0000-000000000000' });
    expect(res.status).toBe(401);
  });

  it('rejects a non-admin caller with 403', async () => {
    const cookies = await signInAs('teacher@example.com', 'teacher');
    const res = await request(app)
      .post('/api/v1/admin/class-memberships/00000000-0000-0000-0000-000000000000/transfer')
      .set('Cookie', cookies)
      .send({ targetSectionId: '00000000-0000-0000-0000-000000000000' });
    expect(res.status).toBe(403);
  });

  it('rejects a non-existent membership with 404', async () => {
    const cookies = await signInAs('admin@example.com', 'admin');
    const section = await createSection();
    const res = await request(app)
      .post('/api/v1/admin/class-memberships/00000000-0000-0000-0000-000000000000/transfer')
      .set('Cookie', cookies)
      .send({ targetSectionId: section.id });
    expect(res.status).toBe(404);
  });

  it('transfers a student to a new section in the current year', async () => {
    const cookies = await signInAs('admin@example.com', 'admin');
    const year = await createAcademicYear({ isCurrent: true });
    const cls = await createClass();
    const sectionA = await createSection({ classId: cls.id, academicYearId: year.id, name: 'A' });
    const sectionB = await createSection({ classId: cls.id, academicYearId: year.id, name: 'B' });
    const batch = await createBatch({ programId: cls.programId });
    const student = await createStudentUser();

    const placeRes = await request(app)
      .post('/api/v1/admin/class-memberships')
      .set('Cookie', cookies)
      .send({ studentId: student.id, sectionId: sectionA.id, batchId: batch.id });

    const res = await request(app)
      .post(`/api/v1/admin/class-memberships/${placeRes.body.data.id}/transfer`)
      .set('Cookie', cookies)
      .send({ targetSectionId: sectionB.id });

    expect(res.status).toBe(200);
    expect(res.body.data.sectionId).toBe(sectionB.id);
  });

  it('rejects a non-existent target section with 404', async () => {
    const cookies = await signInAs('admin@example.com', 'admin');
    const year = await createAcademicYear({ isCurrent: true });
    const cls = await createClass();
    const section = await createSection({ classId: cls.id, academicYearId: year.id });
    const batch = await createBatch({ programId: cls.programId });
    const student = await createStudentUser();

    const placeRes = await request(app)
      .post('/api/v1/admin/class-memberships')
      .set('Cookie', cookies)
      .send({ studentId: student.id, sectionId: section.id, batchId: batch.id });

    const res = await request(app)
      .post(`/api/v1/admin/class-memberships/${placeRes.body.data.id}/transfer`)
      .set('Cookie', cookies)
      .send({ targetSectionId: '00000000-0000-0000-0000-000000000000' });

    expect(res.status).toBe(404);
  });

  it('rejects transferring a membership that has already been promoted with 400', async () => {
    const cookies = await signInAs('admin@example.com', 'admin');
    const program = await createProgram();
    const classA = await createClass({ programId: program.id, orderIndex: 1 });
    const classB = await createClass({ programId: program.id, orderIndex: 2 });
    const oldYear = await createAcademicYear();
    const oldSection = await createSection({
      classId: classA.id,
      academicYearId: oldYear.id,
      name: 'A',
    });
    const batch = await createBatch({ programId: program.id });
    const student = await createStudentUser();

    const placeRes = await request(app)
      .post('/api/v1/admin/class-memberships')
      .set('Cookie', cookies)
      .send({ studentId: student.id, sectionId: oldSection.id, batchId: batch.id });

    const newYear = await createAcademicYear({ isCurrent: true });
    const newSection = await createSection({
      classId: classB.id,
      academicYearId: newYear.id,
      name: 'B',
    });

    // Promote the student — the old membership is now superseded (promotedToId set).
    await request(app)
      .post(`/api/v1/admin/class-memberships/${placeRes.body.data.id}/outcome`)
      .set('Cookie', cookies)
      .send({ outcome: 'promoted', targetSectionId: newSection.id });

    // Transferring the now-superseded old membership must be rejected.
    const res = await request(app)
      .post(`/api/v1/admin/class-memberships/${placeRes.body.data.id}/transfer`)
      .set('Cookie', cookies)
      .send({ targetSectionId: oldSection.id });

    expect(res.status).toBe(400);
  });

  it('rejects transferring to a section in a different academic year with 400', async () => {
    const cookies = await signInAs('admin@example.com', 'admin');
    const currentYear = await createAcademicYear({ isCurrent: true });
    const cls = await createClass();
    const currentSection = await createSection({
      classId: cls.id,
      academicYearId: currentYear.id,
      name: 'A',
    });
    const batch = await createBatch({ programId: cls.programId });
    const futureYear = await createAcademicYear({ isCurrent: false });
    const futureSection = await createSection({ academicYearId: futureYear.id, name: 'B' });
    const student = await createStudentUser();

    const placeRes = await request(app)
      .post('/api/v1/admin/class-memberships')
      .set('Cookie', cookies)
      .send({ studentId: student.id, sectionId: currentSection.id, batchId: batch.id });

    const res = await request(app)
      .post(`/api/v1/admin/class-memberships/${placeRes.body.data.id}/transfer`)
      .set('Cookie', cookies)
      .send({ targetSectionId: futureSection.id });

    expect(res.status).toBe(400);
  });

  it('rejects transferring into a section belonging to a different class with 400', async () => {
    const cookies = await signInAs('admin@example.com', 'admin');
    const year = await createAcademicYear({ isCurrent: true });
    const classA = await createClass();
    const classB = await createClass();
    const sectionA = await createSection({ classId: classA.id, academicYearId: year.id, name: 'A' });
    const sectionB = await createSection({ classId: classB.id, academicYearId: year.id, name: 'B' });
    const batch = await createBatch({ programId: classA.programId });
    const student = await createStudentUser();

    const placeRes = await request(app)
      .post('/api/v1/admin/class-memberships')
      .set('Cookie', cookies)
      .send({ studentId: student.id, sectionId: sectionA.id, batchId: batch.id });

    const res = await request(app)
      .post(`/api/v1/admin/class-memberships/${placeRes.body.data.id}/transfer`)
      .set('Cookie', cookies)
      .send({ targetSectionId: sectionB.id });

    expect(res.status).toBe(400);
  });

  it('rejects transferring a membership for a student who is no longer active with 400', async () => {
    const cookies = await signInAs('admin@example.com', 'admin');
    const year = await createAcademicYear({ isCurrent: true });
    const cls = await createClass();
    const sectionA = await createSection({ classId: cls.id, academicYearId: year.id, name: 'A' });
    const sectionB = await createSection({ classId: sectionA.classId, academicYearId: year.id, name: 'B' });
    const batch = await createBatch({ programId: cls.programId });
    const student = await createStudentUser();

    const placeRes = await request(app)
      .post('/api/v1/admin/class-memberships')
      .set('Cookie', cookies)
      .send({ studentId: student.id, sectionId: sectionA.id, batchId: batch.id });

    await request(app)
      .patch(`/api/v1/admin/users/${student.id}/archive`)
      .set('Cookie', cookies);

    const res = await request(app)
      .post(`/api/v1/admin/class-memberships/${placeRes.body.data.id}/transfer`)
      .set('Cookie', cookies)
      .send({ targetSectionId: sectionB.id });

    expect(res.status).toBe(400);
  });
});

describe('POST /admin/class-memberships/:id/reassign', () => {
  it('rejects an unauthenticated caller with 401', async () => {
    const res = await request(app)
      .post('/api/v1/admin/class-memberships/00000000-0000-0000-0000-000000000000/reassign')
      .send({ targetSectionId: '00000000-0000-0000-0000-000000000000', targetBatchId: '00000000-0000-0000-0000-000000000000' });
    expect(res.status).toBe(401);
  });

  it('rejects a non-admin caller with 403', async () => {
    const cookies = await signInAs('teacher@example.com', 'teacher');
    const res = await request(app)
      .post('/api/v1/admin/class-memberships/00000000-0000-0000-0000-000000000000/reassign')
      .set('Cookie', cookies)
      .send({ targetSectionId: '00000000-0000-0000-0000-000000000000', targetBatchId: '00000000-0000-0000-0000-000000000000' });
    expect(res.status).toBe(403);
  });

  it('reassigns a student across program, class, term, and batch, preserving history as transferred', async () => {
    const cookies = await signInAs('admin@example.com', 'admin');

    // Old program/class/term/batch — placement auto-enrolls the compulsory course.
    const oldProgram = await createProgram();
    const oldClass = await createClass({ programId: oldProgram.id, orderIndex: 1 });
    const oldYear = await createAcademicYear();
    const oldBatch = await createBatch({ programId: oldProgram.id, startAcademicYearId: oldYear.id });
    const oldCourse = await createCourse({ classId: oldClass.id });
    const oldSection = await createSection({ classId: oldClass.id, academicYearId: oldYear.id, name: 'A' });
    const student = await createStudentUser();
    await request(app)
      .post('/api/v1/admin/class-memberships')
      .set('Cookie', cookies)
      .send({ studentId: student.id, sectionId: oldSection.id, batchId: oldBatch.id });

    const beforeRes = await request(app)
      .get('/api/v1/admin/class-memberships')
      .set('Cookie', cookies)
      .query({ studentId: student.id });
    const oldMembershipId = beforeRes.body.data[0].id as string;

    // New program/class/term/batch.
    const newProgram = await createProgram();
    const newClass = await createClass({ programId: newProgram.id, orderIndex: 1 });
    const newYear = await createAcademicYear();
    const newBatch = await createBatch({ programId: newProgram.id, startAcademicYearId: newYear.id });
    const newCourse = await createCourse({ classId: newClass.id });
    const newSection = await createSection({ classId: newClass.id, academicYearId: newYear.id, name: 'B' });

    const res = await request(app)
      .post(`/api/v1/admin/class-memberships/${oldMembershipId}/reassign`)
      .set('Cookie', cookies)
      .send({ targetSectionId: newSection.id, targetBatchId: newBatch.id });

    expect(res.status).toBe(200);
    expect(res.body.data.sectionId).toBe(newSection.id);
    expect(res.body.data.academicYearId).toBe(newYear.id);
    expect(res.body.data.batchId).toBe(newBatch.id);

    const afterRes = await request(app)
      .get('/api/v1/admin/class-memberships')
      .set('Cookie', cookies)
      .query({ studentId: student.id });
    const oldMembership = afterRes.body.data.find(
      (m: { id: string }) => m.id === oldMembershipId,
    );
    expect(oldMembership.outcome).toBe('transferred');
    expect(oldMembership.promotedToId).toBe(res.body.data.id);

    // Enrollments resynced: old course completed, new course auto-enrolled active.
    const enrollmentsRes = await request(app)
      .get('/api/v1/admin/enrollments')
      .set('Cookie', cookies)
      .query({ studentId: student.id });
    const oldEnroll = enrollmentsRes.body.data.find(
      (e: { courseId: string }) => e.courseId === oldCourse.id,
    );
    const newEnroll = enrollmentsRes.body.data.find(
      (e: { courseId: string }) => e.courseId === newCourse.id,
    );
    expect(oldEnroll.status).toBe('completed');
    expect(newEnroll.status).toBe('active');
  });

  it('reassigns within the same academic year in place, keeping a single membership row', async () => {
    const cookies = await signInAs('admin@example.com', 'admin');
    const year = await createAcademicYear();
    const cls = await createClass();
    const sectionA = await createSection({ classId: cls.id, academicYearId: year.id, name: 'A' });
    const sectionB = await createSection({ classId: cls.id, academicYearId: year.id, name: 'B' });
    const batchA = await createBatch({ programId: cls.programId, startAcademicYearId: year.id, name: 'A' });
    const batchB = await createBatch({ programId: cls.programId, startAcademicYearId: year.id, name: 'B' });
    const student = await createStudentUser();

    const placeRes = await request(app)
      .post('/api/v1/admin/class-memberships')
      .set('Cookie', cookies)
      .send({ studentId: student.id, sectionId: sectionA.id, batchId: batchA.id });

    const res = await request(app)
      .post(`/api/v1/admin/class-memberships/${placeRes.body.data.id}/reassign`)
      .set('Cookie', cookies)
      .send({ targetSectionId: sectionB.id, targetBatchId: batchB.id });

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(placeRes.body.data.id);
    expect(res.body.data.sectionId).toBe(sectionB.id);
    expect(res.body.data.batchId).toBe(batchB.id);
    expect(res.body.data.outcome).toBe('enrolled');
  });

  it('rejects a target batch that belongs to a different program than the target section', async () => {
    const cookies = await signInAs('admin@example.com', 'admin');
    const cls = await createClass();
    const sectionA = await createSection({ classId: cls.id, name: 'A' });
    const batchA = await createBatch({ programId: cls.programId });
    const otherProgram = await createProgram();
    const wrongBatch = await createBatch({ programId: otherProgram.id });
    const student = await createStudentUser();

    const placeRes = await request(app)
      .post('/api/v1/admin/class-memberships')
      .set('Cookie', cookies)
      .send({ studentId: student.id, sectionId: sectionA.id, batchId: batchA.id });

    const res = await request(app)
      .post(`/api/v1/admin/class-memberships/${placeRes.body.data.id}/reassign`)
      .set('Cookie', cookies)
      .send({ targetSectionId: sectionA.id, targetBatchId: wrongBatch.id });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/same program as the target section/);
  });

  it('rejects a non-existent target batch with 404', async () => {
    const cookies = await signInAs('admin@example.com', 'admin');
    const cls = await createClass();
    const sectionA = await createSection({ classId: cls.id, name: 'A' });
    const batchA = await createBatch({ programId: cls.programId });
    const student = await createStudentUser();

    const placeRes = await request(app)
      .post('/api/v1/admin/class-memberships')
      .set('Cookie', cookies)
      .send({ studentId: student.id, sectionId: sectionA.id, batchId: batchA.id });

    const res = await request(app)
      .post(`/api/v1/admin/class-memberships/${placeRes.body.data.id}/reassign`)
      .set('Cookie', cookies)
      .send({
        targetSectionId: sectionA.id,
        targetBatchId: '00000000-0000-0000-0000-000000000000',
      });

    expect(res.status).toBe(404);
  });

  it('rejects reassigning a membership that has already been advanced with 400', async () => {
    const cookies = await signInAs('admin@example.com', 'admin');
    const program = await createProgram();
    const classA = await createClass({ programId: program.id, orderIndex: 1 });
    const classB = await createClass({ programId: program.id, orderIndex: 2 });
    const oldYear = await createAcademicYear();
    const oldSection = await createSection({ classId: classA.id, academicYearId: oldYear.id, name: 'A' });
    const batch = await createBatch({ programId: program.id });
    const student = await createStudentUser();

    const placeRes = await request(app)
      .post('/api/v1/admin/class-memberships')
      .set('Cookie', cookies)
      .send({ studentId: student.id, sectionId: oldSection.id, batchId: batch.id });

    const newYear = await createAcademicYear({ isCurrent: true });
    const newSection = await createSection({ classId: classB.id, academicYearId: newYear.id, name: 'B' });
    await request(app)
      .post(`/api/v1/admin/class-memberships/${placeRes.body.data.id}/outcome`)
      .set('Cookie', cookies)
      .send({ outcome: 'promoted', targetSectionId: newSection.id });

    const res = await request(app)
      .post(`/api/v1/admin/class-memberships/${placeRes.body.data.id}/reassign`)
      .set('Cookie', cookies)
      .send({ targetSectionId: oldSection.id, targetBatchId: batch.id });

    expect(res.status).toBe(400);
  });
});

describe('POST /admin/class-memberships/:id/outcome', () => {
  it('rejects an unauthenticated caller with 401', async () => {
    const res = await request(app)
      .post('/api/v1/admin/class-memberships/00000000-0000-0000-0000-000000000000/outcome')
      .send({ outcome: 'graduated' });
    expect(res.status).toBe(401);
  });

  it('rejects a non-admin caller with 403', async () => {
    const cookies = await signInAs('teacher@example.com', 'teacher');
    const res = await request(app)
      .post('/api/v1/admin/class-memberships/00000000-0000-0000-0000-000000000000/outcome')
      .set('Cookie', cookies)
      .send({ outcome: 'graduated' });
    expect(res.status).toBe(403);
  });

  it('rejects a non-existent membership with 404', async () => {
    const cookies = await signInAs('admin@example.com', 'admin');
    const res = await request(app)
      .post('/api/v1/admin/class-memberships/00000000-0000-0000-0000-000000000000/outcome')
      .set('Cookie', cookies)
      .send({ outcome: 'graduated' });
    expect(res.status).toBe(404);
  });

  it('rejects promoted/retained with no targetSectionId with 400', async () => {
    const cookies = await signInAs('admin@example.com', 'admin');
    const oldYear = await createAcademicYear();
    const cls = await createClass();
    const oldSection = await createSection({ classId: cls.id, academicYearId: oldYear.id });
    const batch = await createBatch({ programId: cls.programId });
    const student = await createStudentUser();
    const placeRes = await request(app)
      .post('/api/v1/admin/class-memberships')
      .set('Cookie', cookies)
      .send({ studentId: student.id, sectionId: oldSection.id, batchId: batch.id });

    await createAcademicYear({ isCurrent: true });

    const res = await request(app)
      .post(`/api/v1/admin/class-memberships/${placeRes.body.data.id}/outcome`)
      .set('Cookie', cookies)
      .send({ outcome: 'promoted' });

    expect(res.status).toBe(400);
  });

  it('promotes a student to a new section in the new current year', async () => {
    const cookies = await signInAs('admin@example.com', 'admin');
    const program = await createProgram();
    const classA = await createClass({ programId: program.id, orderIndex: 1 });
    const classB = await createClass({ programId: program.id, orderIndex: 2 });
    const oldYear = await createAcademicYear();
    const oldSection = await createSection({ classId: classA.id, academicYearId: oldYear.id });
    const batch = await createBatch({ programId: program.id });
    const student = await createStudentUser();
    const placeRes = await request(app)
      .post('/api/v1/admin/class-memberships')
      .set('Cookie', cookies)
      .send({ studentId: student.id, sectionId: oldSection.id, batchId: batch.id });

    const newYear = await createAcademicYear({ isCurrent: true });
    const newSection = await createSection({
      classId: classB.id,
      academicYearId: newYear.id,
      name: 'B',
    });

    const res = await request(app)
      .post(`/api/v1/admin/class-memberships/${placeRes.body.data.id}/outcome`)
      .set('Cookie', cookies)
      .send({ outcome: 'promoted', targetSectionId: newSection.id });

    expect(res.status).toBe(201);
    expect(res.body.data.sectionId).toBe(newSection.id);
    expect(res.body.data.academicYearId).toBe(newYear.id);
    expect(res.body.data.batchId).toBe(batch.id);

    const listRes = await request(app)
      .get('/api/v1/admin/class-memberships')
      .query({ studentId: student.id })
      .set('Cookie', cookies);
    const oldRow = listRes.body.data.find(
      (m: { id: string }) => m.id === placeRes.body.data.id,
    );
    expect(oldRow.outcome).toBe('promoted');
    expect(oldRow.promotedToId).toBe(res.body.data.id);
  });

  it('graduates a student and sets their user status', async () => {
    const cookies = await signInAs('admin@example.com', 'admin');
    const year = await createAcademicYear();
    const cls = await createClass();
    const section = await createSection({ classId: cls.id, academicYearId: year.id });
    const batch = await createBatch({ programId: cls.programId });
    const student = await createStudentUser();
    const placeRes = await request(app)
      .post('/api/v1/admin/class-memberships')
      .set('Cookie', cookies)
      .send({ studentId: student.id, sectionId: section.id, batchId: batch.id });

    await createAcademicYear({ isCurrent: true });

    const res = await request(app)
      .post(`/api/v1/admin/class-memberships/${placeRes.body.data.id}/outcome`)
      .set('Cookie', cookies)
      .send({ outcome: 'graduated' });

    expect(res.status).toBe(201);
    expect(res.body.data.outcome).toBe('graduated');

    const updatedUser = await User.findByPk(student.id);
    expect(updatedUser?.status).toBe('graduated');
  });

  it('auto-enrolls on promotion into a school-type program section', async () => {
    const cookies = await signInAs('admin@example.com', 'admin');
    const program = await createProgram({ institutionType: 'school' });
    const classA = await createClass({ programId: program.id, orderIndex: 1 });
    const classB = await createClass({ programId: program.id, orderIndex: 2 });
    const oldYear = await createAcademicYear();
    const oldSection = await createSection({ classId: classA.id, academicYearId: oldYear.id });
    const batch = await createBatch({ programId: program.id });
    const student = await createStudentUser();
    const placeRes = await request(app)
      .post('/api/v1/admin/class-memberships')
      .set('Cookie', cookies)
      .send({ studentId: student.id, sectionId: oldSection.id, batchId: batch.id });

    const newYear = await createAcademicYear({ isCurrent: true });
    const newSection = await createSection({
      classId: classB.id,
      academicYearId: newYear.id,
      name: 'B',
    });
    await createCourse({ classId: classB.id, title: 'Physics', code: `PHYS-${Date.now()}` });

    await request(app)
      .post(`/api/v1/admin/class-memberships/${placeRes.body.data.id}/outcome`)
      .set('Cookie', cookies)
      .send({ outcome: 'promoted', targetSectionId: newSection.id });

    const enrollmentsRes = await request(app)
      .get('/api/v1/admin/enrollments')
      .query({ studentId: student.id, academicYearId: newYear.id })
      .set('Cookie', cookies);

    expect(enrollmentsRes.body.data).toHaveLength(1);
  });

  it('retains a student in a new section in the new current year', async () => {
    const cookies = await signInAs('admin@example.com', 'admin');
    const oldYear = await createAcademicYear();
    const cls = await createClass();
    const oldSection = await createSection({ classId: cls.id, academicYearId: oldYear.id });
    const batch = await createBatch({ programId: cls.programId });
    const student = await createStudentUser();
    const placeRes = await request(app)
      .post('/api/v1/admin/class-memberships')
      .set('Cookie', cookies)
      .send({ studentId: student.id, sectionId: oldSection.id, batchId: batch.id });

    // Retention stays in the same class — a new section under that same class,
    // typically in the next term/year.
    const newYear = await createAcademicYear({ isCurrent: true });
    const newSection = await createSection({
      classId: cls.id,
      academicYearId: newYear.id,
      name: 'B',
    });

    const res = await request(app)
      .post(`/api/v1/admin/class-memberships/${placeRes.body.data.id}/outcome`)
      .set('Cookie', cookies)
      .send({ outcome: 'retained', targetSectionId: newSection.id });

    expect(res.status).toBe(201);
    expect(res.body.data.sectionId).toBe(newSection.id);
    expect(res.body.data.academicYearId).toBe(newYear.id);

    const listRes = await request(app)
      .get('/api/v1/admin/class-memberships')
      .query({ studentId: student.id })
      .set('Cookie', cookies);
    const oldRow = listRes.body.data.find(
      (m: { id: string }) => m.id === placeRes.body.data.id,
    );
    expect(oldRow.outcome).toBe('retained');
    expect(oldRow.promotedToId).toBe(res.body.data.id);
  });

  it('allows promoting into a target section from a different academic year, as long as it is the next class in the same program', async () => {
    // Placement is chain-derived now (promotedToId, not a global "current year"
    // flag) — promotion no longer requires the target section's academic year
    // to match any notion of "current".
    const cookies = await signInAs('admin@example.com', 'admin');
    const program = await createProgram();
    const classA = await createClass({ programId: program.id, orderIndex: 1 });
    const classB = await createClass({ programId: program.id, orderIndex: 2 });
    const oldYear = await createAcademicYear();
    const oldSection = await createSection({ classId: classA.id, academicYearId: oldYear.id });
    const batch = await createBatch({ programId: program.id });
    const student = await createStudentUser();
    const placeRes = await request(app)
      .post('/api/v1/admin/class-memberships')
      .set('Cookie', cookies)
      .send({ studentId: student.id, sectionId: oldSection.id, batchId: batch.id });

    await createAcademicYear({ isCurrent: true }); // unrelated "current" year — irrelevant now
    const staleYear = await createAcademicYear();
    const staleSection = await createSection({
      classId: classB.id,
      academicYearId: staleYear.id,
      name: 'B',
    });

    const res = await request(app)
      .post(`/api/v1/admin/class-memberships/${placeRes.body.data.id}/outcome`)
      .set('Cookie', cookies)
      .send({ outcome: 'promoted', targetSectionId: staleSection.id });

    expect(res.status).toBe(201);
    expect(res.body.data.sectionId).toBe(staleSection.id);
  });

  it('rejects promoting into a target section in the same academic year as the current placement, with 400', async () => {
    // Real-world trigger: an admin creates the next class's section under the
    // SAME academic_years row as the current one (hasn't created a new term
    // yet). class_memberships has UNIQUE(studentId, academicYearId), and
    // promote() inserts the new row before closing the old one, so without
    // this guard the request fails with a raw, confusing Postgres unique-
    // constraint error instead of an actionable ApiError.
    const cookies = await signInAs('admin@example.com', 'admin');
    const program = await createProgram();
    const classA = await createClass({ programId: program.id, orderIndex: 1 });
    const classB = await createClass({ programId: program.id, orderIndex: 2 });
    const sharedYear = await createAcademicYear();
    const oldSection = await createSection({ classId: classA.id, academicYearId: sharedYear.id });
    const batch = await createBatch({ programId: program.id });
    const student = await createStudentUser();
    const placeRes = await request(app)
      .post('/api/v1/admin/class-memberships')
      .set('Cookie', cookies)
      .send({ studentId: student.id, sectionId: oldSection.id, batchId: batch.id });

    const sameYearSection = await createSection({
      classId: classB.id,
      academicYearId: sharedYear.id,
      name: 'B',
    });

    const res = await request(app)
      .post(`/api/v1/admin/class-memberships/${placeRes.body.data.id}/outcome`)
      .set('Cookie', cookies)
      .send({ outcome: 'promoted', targetSectionId: sameYearSection.id });

    expect(res.status).toBe(400);
    expect(res.body.message).not.toMatch(/must be unique/i);
  });

  it('rejects promoting into a target section whose academic year the student already passed through earlier in their history, with 400', async () => {
    // Real-world trigger (see justishan35's actual promotion failure): a
    // student is promoted from class A -> class B -> and the target section
    // for class C reuses class A's academic year (e.g. the next real term's
    // academic year row hasn't been created yet, or was created with the
    // wrong `term`). The current membership's academic year differs from the
    // target, so the same-year guard above doesn't catch it, but
    // class_memberships still has UNIQUE(studentId, academicYearId) against
    // the student's full history, not just their current row.
    const cookies = await signInAs('admin@example.com', 'admin');
    const program = await createProgram();
    const classA = await createClass({ programId: program.id, orderIndex: 1 });
    const classB = await createClass({ programId: program.id, orderIndex: 2 });
    const classC = await createClass({ programId: program.id, orderIndex: 3 });
    const yearA = await createAcademicYear();
    const yearB = await createAcademicYear();
    const sectionA = await createSection({ classId: classA.id, academicYearId: yearA.id });
    const sectionB = await createSection({ classId: classB.id, academicYearId: yearB.id });
    const reusedSectionC = await createSection({
      classId: classC.id,
      academicYearId: yearA.id,
      name: 'B',
    });
    const batch = await createBatch({ programId: program.id });
    const student = await createStudentUser();

    const placeRes = await request(app)
      .post('/api/v1/admin/class-memberships')
      .set('Cookie', cookies)
      .send({ studentId: student.id, sectionId: sectionA.id, batchId: batch.id });

    const promoteToB = await request(app)
      .post(`/api/v1/admin/class-memberships/${placeRes.body.data.id}/outcome`)
      .set('Cookie', cookies)
      .send({ outcome: 'promoted', targetSectionId: sectionB.id });
    expect(promoteToB.status).toBe(201);

    const promoteToC = await request(app)
      .post(`/api/v1/admin/class-memberships/${promoteToB.body.data.id}/outcome`)
      .set('Cookie', cookies)
      .send({ outcome: 'promoted', targetSectionId: reusedSectionC.id });

    expect(promoteToC.status).toBe(400);
    expect(promoteToC.body.message).not.toMatch(/must be unique/i);
  });

  it('rejects promoting into a target section that is already at capacity, with 400', async () => {
    const cookies = await signInAs('admin@example.com', 'admin');
    const program = await createProgram();
    const classA = await createClass({ programId: program.id, orderIndex: 1 });
    const classB = await createClass({ programId: program.id, orderIndex: 2 });
    const oldYear = await createAcademicYear();
    const newYear = await createAcademicYear({ name: 'next' });
    const sectionA1 = await createSection({ classId: classA.id, academicYearId: oldYear.id, name: 'A1' });
    const sectionA2 = await createSection({ classId: classA.id, academicYearId: oldYear.id, name: 'A2' });
    const fullTargetSection = await createSection({
      classId: classB.id,
      academicYearId: newYear.id,
      capacity: 1,
    });
    const batch = await createBatch({ programId: program.id });

    const studentAlreadyThere = await createStudentUser();
    const placeAlreadyThereRes = await request(app)
      .post('/api/v1/admin/class-memberships')
      .set('Cookie', cookies)
      .send({ studentId: studentAlreadyThere.id, sectionId: sectionA1.id, batchId: batch.id });
    await request(app)
      .post(`/api/v1/admin/class-memberships/${placeAlreadyThereRes.body.data.id}/outcome`)
      .set('Cookie', cookies)
      .send({ outcome: 'promoted', targetSectionId: fullTargetSection.id });

    const studentBeingPromoted = await createStudentUser();
    const placeRes = await request(app)
      .post('/api/v1/admin/class-memberships')
      .set('Cookie', cookies)
      .send({ studentId: studentBeingPromoted.id, sectionId: sectionA2.id, batchId: batch.id });

    const res = await request(app)
      .post(`/api/v1/admin/class-memberships/${placeRes.body.data.id}/outcome`)
      .set('Cookie', cookies)
      .send({ outcome: 'promoted', targetSectionId: fullTargetSection.id });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/at capacity/i);
  });

  it('rejects promoting into a target section from a different program with 400', async () => {
    const cookies = await signInAs('admin@example.com', 'admin');
    const program = await createProgram();
    const cls = await createClass({ programId: program.id, orderIndex: 1 });
    const oldYear = await createAcademicYear();
    const oldSection = await createSection({ classId: cls.id, academicYearId: oldYear.id });
    const batch = await createBatch({ programId: program.id });
    const student = await createStudentUser();
    const placeRes = await request(app)
      .post('/api/v1/admin/class-memberships')
      .set('Cookie', cookies)
      .send({ studentId: student.id, sectionId: oldSection.id, batchId: batch.id });

    const otherProgram = await createProgram();
    const otherProgramClass = await createClass({ programId: otherProgram.id, orderIndex: 2 });
    const otherSection = await createSection({ classId: otherProgramClass.id, name: 'B' });

    const res = await request(app)
      .post(`/api/v1/admin/class-memberships/${placeRes.body.data.id}/outcome`)
      .set('Cookie', cookies)
      .send({ outcome: 'promoted', targetSectionId: otherSection.id });

    expect(res.status).toBe(400);
  });

  it('rejects promoting into a class that skips ahead of the next order_index with 400', async () => {
    const cookies = await signInAs('admin@example.com', 'admin');
    const program = await createProgram();
    const classA = await createClass({ programId: program.id, orderIndex: 1 });
    await createClass({ programId: program.id, orderIndex: 2 });
    const classC = await createClass({ programId: program.id, orderIndex: 3 });
    const oldYear = await createAcademicYear();
    const oldSection = await createSection({ classId: classA.id, academicYearId: oldYear.id });
    const batch = await createBatch({ programId: program.id });
    const student = await createStudentUser();
    const placeRes = await request(app)
      .post('/api/v1/admin/class-memberships')
      .set('Cookie', cookies)
      .send({ studentId: student.id, sectionId: oldSection.id, batchId: batch.id });

    // classC is orderIndex 3 — skips over classB (orderIndex 2).
    const skipSection = await createSection({ classId: classC.id, name: 'B' });

    const res = await request(app)
      .post(`/api/v1/admin/class-memberships/${placeRes.body.data.id}/outcome`)
      .set('Cookie', cookies)
      .send({ outcome: 'promoted', targetSectionId: skipSection.id });

    expect(res.status).toBe(400);
  });

  it('rejects retaining into a different class with 400', async () => {
    const cookies = await signInAs('admin@example.com', 'admin');
    const program = await createProgram();
    const classA = await createClass({ programId: program.id, orderIndex: 1 });
    const classB = await createClass({ programId: program.id, orderIndex: 2 });
    const oldYear = await createAcademicYear();
    const oldSection = await createSection({ classId: classA.id, academicYearId: oldYear.id });
    const batch = await createBatch({ programId: program.id });
    const student = await createStudentUser();
    const placeRes = await request(app)
      .post('/api/v1/admin/class-memberships')
      .set('Cookie', cookies)
      .send({ studentId: student.id, sectionId: oldSection.id, batchId: batch.id });

    const otherClassSection = await createSection({ classId: classB.id, name: 'B' });

    const res = await request(app)
      .post(`/api/v1/admin/class-memberships/${placeRes.body.data.id}/outcome`)
      .set('Cookie', cookies)
      .send({ outcome: 'retained', targetSectionId: otherClassSection.id });

    expect(res.status).toBe(400);
  });

  it('rejects graduating a membership whose class is not the program\'s last class with 400', async () => {
    const cookies = await signInAs('admin@example.com', 'admin');
    const program = await createProgram();
    const classA = await createClass({ programId: program.id, orderIndex: 1 });
    await createClass({ programId: program.id, orderIndex: 2 });
    const oldYear = await createAcademicYear();
    const section = await createSection({ classId: classA.id, academicYearId: oldYear.id });
    const batch = await createBatch({ programId: program.id });
    const student = await createStudentUser();
    const placeRes = await request(app)
      .post('/api/v1/admin/class-memberships')
      .set('Cookie', cookies)
      .send({ studentId: student.id, sectionId: section.id, batchId: batch.id });

    const res = await request(app)
      .post(`/api/v1/admin/class-memberships/${placeRes.body.data.id}/outcome`)
      .set('Cookie', cookies)
      .send({ outcome: 'graduated' });

    expect(res.status).toBe(400);
  });

  it('rejects promoting a membership that has already been promoted once with 400', async () => {
    const cookies = await signInAs('admin@example.com', 'admin');
    const program = await createProgram();
    const classA = await createClass({ programId: program.id, orderIndex: 1 });
    const classB = await createClass({ programId: program.id, orderIndex: 2 });
    const classC = await createClass({ programId: program.id, orderIndex: 3 });
    const oldYear = await createAcademicYear();
    const oldSection = await createSection({ classId: classA.id, academicYearId: oldYear.id });
    const batch = await createBatch({ programId: program.id });
    const student = await createStudentUser();
    const placeRes = await request(app)
      .post('/api/v1/admin/class-memberships')
      .set('Cookie', cookies)
      .send({ studentId: student.id, sectionId: oldSection.id, batchId: batch.id });

    const sectionB = await createSection({ classId: classB.id, name: 'B' });
    await request(app)
      .post(`/api/v1/admin/class-memberships/${placeRes.body.data.id}/outcome`)
      .set('Cookie', cookies)
      .send({ outcome: 'promoted', targetSectionId: sectionB.id });

    // Attempting to promote the same (now-superseded) membership again must be rejected.
    const sectionC = await createSection({ classId: classC.id, name: 'C' });
    const res = await request(app)
      .post(`/api/v1/admin/class-memberships/${placeRes.body.data.id}/outcome`)
      .set('Cookie', cookies)
      .send({ outcome: 'promoted', targetSectionId: sectionC.id });

    expect(res.status).toBe(400);
  });

  it('rejects setting an outcome for a student who is no longer active with 400', async () => {
    const cookies = await signInAs('admin@example.com', 'admin');
    const oldYear = await createAcademicYear();
    const cls = await createClass();
    const oldSection = await createSection({ classId: cls.id, academicYearId: oldYear.id });
    const batch = await createBatch({ programId: cls.programId });
    const student = await createStudentUser();
    const placeRes = await request(app)
      .post('/api/v1/admin/class-memberships')
      .set('Cookie', cookies)
      .send({ studentId: student.id, sectionId: oldSection.id, batchId: batch.id });

    await createAcademicYear({ isCurrent: true });

    await request(app)
      .patch(`/api/v1/admin/users/${student.id}/archive`)
      .set('Cookie', cookies);

    const res = await request(app)
      .post(`/api/v1/admin/class-memberships/${placeRes.body.data.id}/outcome`)
      .set('Cookie', cookies)
      .send({ outcome: 'graduated' });

    expect(res.status).toBe(400);
  });

  it('rejects setting an outcome on a membership that already recorded a graduation with 400', async () => {
    const cookies = await signInAs('admin@example.com', 'admin');
    const oldYear = await createAcademicYear();
    const cls = await createClass();
    const oldSection = await createSection({ classId: cls.id, academicYearId: oldYear.id });
    const batch = await createBatch({ programId: cls.programId });
    const student = await createStudentUser();
    const placeRes = await request(app)
      .post('/api/v1/admin/class-memberships')
      .set('Cookie', cookies)
      .send({ studentId: student.id, sectionId: oldSection.id, batchId: batch.id });

    await createAcademicYear({ isCurrent: true });

    const graduateRes = await request(app)
      .post(`/api/v1/admin/class-memberships/${placeRes.body.data.id}/outcome`)
      .set('Cookie', cookies)
      .send({ outcome: 'graduated' });
    expect(graduateRes.status).toBe(201);

    const newSection = await createSection({ academicYearId: oldYear.id, name: 'C' });
    const res = await request(app)
      .post(`/api/v1/admin/class-memberships/${placeRes.body.data.id}/outcome`)
      .set('Cookie', cookies)
      .send({ outcome: 'promoted', targetSectionId: newSection.id });

    expect(res.status).toBe(400);
  });
});
