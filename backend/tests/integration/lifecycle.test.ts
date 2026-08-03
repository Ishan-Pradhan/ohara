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

  it('rejects hard-deleting a student with existing class memberships with 409', async () => {
    const cookies = await signInAs('admin@example.com', 'admin');
    const section = await createSection();
    const student = await createStudentUser();
    await request(app)
      .post('/api/v1/admin/class-memberships')
      .set('Cookie', cookies)
      .send({ studentId: student.id, sectionId: section.id });

    const res = await request(app)
      .delete(`/api/v1/admin/users/${student.id}`)
      .set('Cookie', cookies)
      .send({ confirmHardDelete: true });

    expect(res.status).toBe(409);
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
    const student = await createStudentUser();

    const placeRes = await request(app)
      .post('/api/v1/admin/class-memberships')
      .set('Cookie', cookies)
      .send({ studentId: student.id, sectionId: sectionA.id });

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
    const section = await createSection({ academicYearId: year.id });
    const student = await createStudentUser();

    const placeRes = await request(app)
      .post('/api/v1/admin/class-memberships')
      .set('Cookie', cookies)
      .send({ studentId: student.id, sectionId: section.id });

    const res = await request(app)
      .post(`/api/v1/admin/class-memberships/${placeRes.body.data.id}/transfer`)
      .set('Cookie', cookies)
      .send({ targetSectionId: '00000000-0000-0000-0000-000000000000' });

    expect(res.status).toBe(404);
  });

  it('rejects transferring a membership from a non-current academic year with 400', async () => {
    const cookies = await signInAs('admin@example.com', 'admin');
    const oldYear = await createAcademicYear();
    const oldSection = await createSection({ academicYearId: oldYear.id, name: 'A' });
    const newSection = await createSection({ academicYearId: oldYear.id, name: 'B' });
    const student = await createStudentUser();

    const placeRes = await request(app)
      .post('/api/v1/admin/class-memberships')
      .set('Cookie', cookies)
      .send({ studentId: student.id, sectionId: oldSection.id });

    await createAcademicYear({ isCurrent: true }); // a different, current year

    const res = await request(app)
      .post(`/api/v1/admin/class-memberships/${placeRes.body.data.id}/transfer`)
      .set('Cookie', cookies)
      .send({ targetSectionId: newSection.id });

    expect(res.status).toBe(400);
  });

  it('rejects transferring to a section in a different academic year with 400', async () => {
    const cookies = await signInAs('admin@example.com', 'admin');
    const currentYear = await createAcademicYear({ isCurrent: true });
    const currentSection = await createSection({ academicYearId: currentYear.id, name: 'A' });
    const futureYear = await createAcademicYear({ isCurrent: false });
    const futureSection = await createSection({ academicYearId: futureYear.id, name: 'B' });
    const student = await createStudentUser();

    const placeRes = await request(app)
      .post('/api/v1/admin/class-memberships')
      .set('Cookie', cookies)
      .send({ studentId: student.id, sectionId: currentSection.id });

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
    const student = await createStudentUser();

    const placeRes = await request(app)
      .post('/api/v1/admin/class-memberships')
      .set('Cookie', cookies)
      .send({ studentId: student.id, sectionId: sectionA.id });

    const res = await request(app)
      .post(`/api/v1/admin/class-memberships/${placeRes.body.data.id}/transfer`)
      .set('Cookie', cookies)
      .send({ targetSectionId: sectionB.id });

    expect(res.status).toBe(400);
  });

  it('rejects transferring a membership for a student who is no longer active with 400', async () => {
    const cookies = await signInAs('admin@example.com', 'admin');
    const year = await createAcademicYear({ isCurrent: true });
    const sectionA = await createSection({ academicYearId: year.id, name: 'A' });
    const sectionB = await createSection({ classId: sectionA.classId, academicYearId: year.id, name: 'B' });
    const student = await createStudentUser();

    const placeRes = await request(app)
      .post('/api/v1/admin/class-memberships')
      .set('Cookie', cookies)
      .send({ studentId: student.id, sectionId: sectionA.id });

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

  it('rejects setting an outcome on a membership already for the current year with 400', async () => {
    const cookies = await signInAs('admin@example.com', 'admin');
    const year = await createAcademicYear({ isCurrent: true });
    const section = await createSection({ academicYearId: year.id });
    const student = await createStudentUser();
    const placeRes = await request(app)
      .post('/api/v1/admin/class-memberships')
      .set('Cookie', cookies)
      .send({ studentId: student.id, sectionId: section.id });

    const res = await request(app)
      .post(`/api/v1/admin/class-memberships/${placeRes.body.data.id}/outcome`)
      .set('Cookie', cookies)
      .send({ outcome: 'promoted', targetSectionId: section.id });

    expect(res.status).toBe(400);
  });

  it('rejects promoted/retained with no targetSectionId with 400', async () => {
    const cookies = await signInAs('admin@example.com', 'admin');
    const oldYear = await createAcademicYear();
    const oldSection = await createSection({ academicYearId: oldYear.id });
    const student = await createStudentUser();
    const placeRes = await request(app)
      .post('/api/v1/admin/class-memberships')
      .set('Cookie', cookies)
      .send({ studentId: student.id, sectionId: oldSection.id });

    await createAcademicYear({ isCurrent: true });

    const res = await request(app)
      .post(`/api/v1/admin/class-memberships/${placeRes.body.data.id}/outcome`)
      .set('Cookie', cookies)
      .send({ outcome: 'promoted' });

    expect(res.status).toBe(400);
  });

  it('promotes a student to a new section in the new current year', async () => {
    const cookies = await signInAs('admin@example.com', 'admin');
    const oldYear = await createAcademicYear();
    const oldSection = await createSection({ academicYearId: oldYear.id });
    const student = await createStudentUser();
    const placeRes = await request(app)
      .post('/api/v1/admin/class-memberships')
      .set('Cookie', cookies)
      .send({ studentId: student.id, sectionId: oldSection.id });

    const newYear = await createAcademicYear({ isCurrent: true });
    const newSection = await createSection({ academicYearId: newYear.id, name: 'B' });

    const res = await request(app)
      .post(`/api/v1/admin/class-memberships/${placeRes.body.data.id}/outcome`)
      .set('Cookie', cookies)
      .send({ outcome: 'promoted', targetSectionId: newSection.id });

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
    expect(oldRow.outcome).toBe('promoted');
    expect(oldRow.promotedToId).toBe(res.body.data.id);
  });

  it('graduates a student and sets their user status', async () => {
    const cookies = await signInAs('admin@example.com', 'admin');
    const year = await createAcademicYear();
    const section = await createSection({ academicYearId: year.id });
    const student = await createStudentUser();
    const placeRes = await request(app)
      .post('/api/v1/admin/class-memberships')
      .set('Cookie', cookies)
      .send({ studentId: student.id, sectionId: section.id });

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
    const cls = await createClass({ programId: program.id });
    const oldYear = await createAcademicYear();
    const oldSection = await createSection({ classId: cls.id, academicYearId: oldYear.id });
    const student = await createStudentUser();
    const placeRes = await request(app)
      .post('/api/v1/admin/class-memberships')
      .set('Cookie', cookies)
      .send({ studentId: student.id, sectionId: oldSection.id });

    const newYear = await createAcademicYear({ isCurrent: true });
    const newSection = await createSection({
      classId: cls.id,
      academicYearId: newYear.id,
      name: 'B',
    });
    await createCourse({ classId: cls.id, title: 'Physics', code: `PHYS-${Date.now()}` });

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
    const oldSection = await createSection({ academicYearId: oldYear.id });
    const student = await createStudentUser();
    const placeRes = await request(app)
      .post('/api/v1/admin/class-memberships')
      .set('Cookie', cookies)
      .send({ studentId: student.id, sectionId: oldSection.id });

    const newYear = await createAcademicYear({ isCurrent: true });
    const newSection = await createSection({ academicYearId: newYear.id, name: 'B' });

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

  it('rejects promoting into a target section from a non-current academic year with 400', async () => {
    const cookies = await signInAs('admin@example.com', 'admin');
    const oldYear = await createAcademicYear();
    const oldSection = await createSection({ academicYearId: oldYear.id });
    const student = await createStudentUser();
    const placeRes = await request(app)
      .post('/api/v1/admin/class-memberships')
      .set('Cookie', cookies)
      .send({ studentId: student.id, sectionId: oldSection.id });

    await createAcademicYear({ isCurrent: true });
    const staleYear = await createAcademicYear();
    const staleSection = await createSection({ academicYearId: staleYear.id, name: 'B' });

    const res = await request(app)
      .post(`/api/v1/admin/class-memberships/${placeRes.body.data.id}/outcome`)
      .set('Cookie', cookies)
      .send({ outcome: 'promoted', targetSectionId: staleSection.id });

    expect(res.status).toBe(400);
  });

  it('rejects setting an outcome for a student who is no longer active with 400', async () => {
    const cookies = await signInAs('admin@example.com', 'admin');
    const oldYear = await createAcademicYear();
    const oldSection = await createSection({ academicYearId: oldYear.id });
    const student = await createStudentUser();
    const placeRes = await request(app)
      .post('/api/v1/admin/class-memberships')
      .set('Cookie', cookies)
      .send({ studentId: student.id, sectionId: oldSection.id });

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
    const oldSection = await createSection({ academicYearId: oldYear.id });
    const student = await createStudentUser();
    const placeRes = await request(app)
      .post('/api/v1/admin/class-memberships')
      .set('Cookie', cookies)
      .send({ studentId: student.id, sectionId: oldSection.id });

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
