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

const PROGRAMS = '/api/v1/admin/programs';
const PASSWORD = 'hunter2secret';

type Role = 'admin' | 'teacher' | 'student' | 'alumni';

/** Same pattern as tests/integration/rbac.test.ts's local helper. */
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

describe('POST /admin/programs', () => {
  it('rejects an unauthenticated caller with 401', async () => {
    const res = await request(app)
      .post(PROGRAMS)
      .send({ name: 'Engineering', institutionType: 'college' });
    expect(res.status).toBe(401);
  });

  it('rejects a non-admin caller with 403', async () => {
    const cookies = await signInAs('teacher@example.com', 'teacher');
    const res = await request(app)
      .post(PROGRAMS)
      .set('Cookie', cookies)
      .send({ name: 'Engineering', institutionType: 'college' });
    expect(res.status).toBe(403);
  });

  it('rejects a missing name with 400', async () => {
    const cookies = await signInAs('admin@example.com', 'admin');
    const res = await request(app)
      .post(PROGRAMS)
      .set('Cookie', cookies)
      .send({ institutionType: 'college' });
    expect(res.status).toBe(400);
  });

  it('creates a program as admin', async () => {
    const cookies = await signInAs('admin@example.com', 'admin');
    const res = await request(app)
      .post(PROGRAMS)
      .set('Cookie', cookies)
      .send({
        name: 'Engineering',
        institutionType: 'college',
        description: 'STEM programs',
      });

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      name: 'Engineering',
      institutionType: 'college',
      description: 'STEM programs',
    });
  });
});

describe('GET /admin/programs', () => {
  it('lists created programs', async () => {
    const cookies = await signInAs('admin@example.com', 'admin');
    await request(app)
      .post(PROGRAMS)
      .set('Cookie', cookies)
      .send({ name: 'Engineering', institutionType: 'college' });

    const res = await request(app).get(PROGRAMS).set('Cookie', cookies);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].name).toBe('Engineering');
  });
});

describe('PATCH /admin/programs/:id', () => {
  it('rejects a non-existent id with 404', async () => {
    const cookies = await signInAs('admin@example.com', 'admin');
    const res = await request(app)
      .patch(`${PROGRAMS}/00000000-0000-0000-0000-000000000000`)
      .set('Cookie', cookies)
      .send({ name: 'Renamed' });
    expect(res.status).toBe(404);
  });

  it('updates a program as admin', async () => {
    const cookies = await signInAs('admin@example.com', 'admin');
    const created = await request(app)
      .post(PROGRAMS)
      .set('Cookie', cookies)
      .send({ name: 'Engineering', institutionType: 'college' });

    const res = await request(app)
      .patch(`${PROGRAMS}/${created.body.data.id}`)
      .set('Cookie', cookies)
      .send({ name: 'Engineering & Applied Science' });

    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('Engineering & Applied Science');
  });
});

describe('DELETE /admin/programs/:id', () => {
  it('rejects a non-existent id with 404', async () => {
    const cookies = await signInAs('admin@example.com', 'admin');
    const res = await request(app)
      .delete(`${PROGRAMS}/00000000-0000-0000-0000-000000000000`)
      .set('Cookie', cookies);
    expect(res.status).toBe(404);
  });

  it('deletes a program with no classes', async () => {
    const cookies = await signInAs('admin@example.com', 'admin');
    const created = await request(app)
      .post(PROGRAMS)
      .set('Cookie', cookies)
      .send({ name: 'Engineering', institutionType: 'college' });

    const res = await request(app)
      .delete(`${PROGRAMS}/${created.body.data.id}`)
      .set('Cookie', cookies);
    expect(res.status).toBe(200);

    const list = await request(app).get(PROGRAMS).set('Cookie', cookies);
    expect(list.body.data).toHaveLength(0);
  });

  it('rejects deleting a program that still has classes with 409', async () => {
    const cookies = await signInAs('admin@example.com', 'admin');
    const program = await createProgram();
    await createClassHelper({ programId: program.id });

    const res = await request(app)
      .delete(`${PROGRAMS}/${program.id}`)
      .set('Cookie', cookies);
    expect(res.status).toBe(409);
  });
});

const { createProgram, createClass: createClassHelper } = await import('../helpers/institution.js');

const CLASSES = '/api/v1/admin/classes';

describe('POST /admin/classes', () => {
  it('rejects an unauthenticated caller with 401', async () => {
    const res = await request(app)
      .post(CLASSES)
      .send({ programId: 'x', name: 'Grade 10', orderIndex: 1 });
    expect(res.status).toBe(401);
  });

  it('rejects a non-admin caller with 403', async () => {
    const cookies = await signInAs('teacher@example.com', 'teacher');
    const program = await createProgram();
    const res = await request(app)
      .post(CLASSES)
      .set('Cookie', cookies)
      .send({ programId: program.id, name: 'Grade 10', orderIndex: 1 });
    expect(res.status).toBe(403);
  });

  it('rejects a non-existent programId with 404', async () => {
    const cookies = await signInAs('admin@example.com', 'admin');
    const res = await request(app)
      .post(CLASSES)
      .set('Cookie', cookies)
      .send({
        programId: '00000000-0000-0000-0000-000000000000',
        name: 'Grade 10',
        orderIndex: 1,
      });
    expect(res.status).toBe(404);
  });

  it('creates a class as admin', async () => {
    const cookies = await signInAs('admin@example.com', 'admin');
    const program = await createProgram();
    const res = await request(app)
      .post(CLASSES)
      .set('Cookie', cookies)
      .send({ programId: program.id, name: 'Grade 10', orderIndex: 1 });

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      programId: program.id,
      name: 'Grade 10',
      orderIndex: 1,
    });
  });

  it('rejects a duplicate (programId, orderIndex) with 400', async () => {
    const cookies = await signInAs('admin@example.com', 'admin');
    const program = await createProgram();
    await request(app)
      .post(CLASSES)
      .set('Cookie', cookies)
      .send({ programId: program.id, name: 'Grade 10', orderIndex: 1 });

    const res = await request(app)
      .post(CLASSES)
      .set('Cookie', cookies)
      .send({ programId: program.id, name: 'Grade 10 (alt)', orderIndex: 1 });

    expect(res.status).toBe(400);
  });
});

describe('GET /admin/classes', () => {
  it('filters by programId', async () => {
    const cookies = await signInAs('admin@example.com', 'admin');
    const programA = await createProgram({ name: 'A' });
    const programB = await createProgram({ name: 'B' });
    await request(app)
      .post(CLASSES)
      .set('Cookie', cookies)
      .send({ programId: programA.id, name: 'Grade 10', orderIndex: 1 });
    await request(app)
      .post(CLASSES)
      .set('Cookie', cookies)
      .send({ programId: programB.id, name: 'Year 1', orderIndex: 1 });

    const res = await request(app)
      .get(CLASSES)
      .query({ programId: programA.id })
      .set('Cookie', cookies);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].name).toBe('Grade 10');
  });
});

describe('PATCH /admin/classes/:id', () => {
  it('rejects a non-existent id with 404', async () => {
    const cookies = await signInAs('admin@example.com', 'admin');
    const res = await request(app)
      .patch(`${CLASSES}/00000000-0000-0000-0000-000000000000`)
      .set('Cookie', cookies)
      .send({ name: 'Renamed' });
    expect(res.status).toBe(404);
  });

  it('updates a class as admin', async () => {
    const cookies = await signInAs('admin@example.com', 'admin');
    const cls = await createClassHelper();

    const res = await request(app)
      .patch(`${CLASSES}/${cls.id}`)
      .set('Cookie', cookies)
      .send({ name: 'Grade 11', orderIndex: 2 });

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ name: 'Grade 11', orderIndex: 2 });
  });
});

describe('DELETE /admin/classes/:id', () => {
  it('rejects a non-existent id with 404', async () => {
    const cookies = await signInAs('admin@example.com', 'admin');
    const res = await request(app)
      .delete(`${CLASSES}/00000000-0000-0000-0000-000000000000`)
      .set('Cookie', cookies);
    expect(res.status).toBe(404);
  });

  it('deletes a class with no sections or courses', async () => {
    const cookies = await signInAs('admin@example.com', 'admin');
    const cls = await createClassHelper();

    const res = await request(app)
      .delete(`${CLASSES}/${cls.id}`)
      .set('Cookie', cookies);
    expect(res.status).toBe(200);
  });

  it('rejects deleting a class that still has courses with 409', async () => {
    const cookies = await signInAs('admin@example.com', 'admin');
    const cls = await createClassHelper();
    const { createCourse: createCourseHelper } = await import('../helpers/institution.js');
    await createCourseHelper({ classId: cls.id });

    const res = await request(app)
      .delete(`${CLASSES}/${cls.id}`)
      .set('Cookie', cookies);
    expect(res.status).toBe(409);
  });
});

const { createAcademicYear: createAcademicYearHelper, createBatch: createBatchHelper } =
  await import('../helpers/institution.js');

const BATCHES = '/api/v1/admin/batches';

describe('POST /admin/batches', () => {
  it('rejects an unauthenticated caller with 401', async () => {
    const res = await request(app)
      .post(BATCHES)
      .send({ programId: 'x', name: '26/27', startAcademicYearId: 'x' });
    expect(res.status).toBe(401);
  });

  it('rejects a non-admin caller with 403', async () => {
    const cookies = await signInAs('teacher@example.com', 'teacher');
    const program = await createProgram();
    const academicYear = await createAcademicYearHelper();
    const res = await request(app)
      .post(BATCHES)
      .set('Cookie', cookies)
      .send({ programId: program.id, name: '26/27', startAcademicYearId: academicYear.id });
    expect(res.status).toBe(403);
  });

  it('rejects a non-existent programId with 404', async () => {
    const cookies = await signInAs('admin@example.com', 'admin');
    const academicYear = await createAcademicYearHelper();
    const res = await request(app)
      .post(BATCHES)
      .set('Cookie', cookies)
      .send({
        programId: '00000000-0000-0000-0000-000000000000',
        name: '26/27',
        startAcademicYearId: academicYear.id,
      });
    expect(res.status).toBe(404);
  });

  it('rejects a non-existent startAcademicYearId with 404', async () => {
    const cookies = await signInAs('admin@example.com', 'admin');
    const program = await createProgram();
    const res = await request(app)
      .post(BATCHES)
      .set('Cookie', cookies)
      .send({
        programId: program.id,
        name: '26/27',
        startAcademicYearId: '00000000-0000-0000-0000-000000000000',
      });
    expect(res.status).toBe(404);
  });

  it('creates a batch under a program', async () => {
    const cookies = await signInAs('admin@example.com', 'admin');
    const program = await createProgram();
    const academicYear = await createAcademicYearHelper();
    const res = await request(app)
      .post(BATCHES)
      .set('Cookie', cookies)
      .send({ programId: program.id, name: '26/27', startAcademicYearId: academicYear.id });

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      programId: program.id,
      name: '26/27',
      startAcademicYearId: academicYear.id,
    });
  });

  it('rejects a duplicate batch name within the same program with 400', async () => {
    const cookies = await signInAs('admin@example.com', 'admin');
    const program = await createProgram();
    const academicYear = await createAcademicYearHelper();
    await request(app)
      .post(BATCHES)
      .set('Cookie', cookies)
      .send({ programId: program.id, name: 'Dup', startAcademicYearId: academicYear.id });

    const res = await request(app)
      .post(BATCHES)
      .set('Cookie', cookies)
      .send({ programId: program.id, name: 'Dup', startAcademicYearId: academicYear.id });

    expect(res.status).toBe(400);
  });
});

describe('GET /admin/batches', () => {
  it('filters by programId', async () => {
    const cookies = await signInAs('admin@example.com', 'admin');
    const programA = await createProgram({ name: 'A' });
    const programB = await createProgram({ name: 'B' });
    const academicYear = await createAcademicYearHelper();
    await request(app)
      .post(BATCHES)
      .set('Cookie', cookies)
      .send({ programId: programA.id, name: '26/27', startAcademicYearId: academicYear.id });
    await request(app)
      .post(BATCHES)
      .set('Cookie', cookies)
      .send({ programId: programB.id, name: '27/28', startAcademicYearId: academicYear.id });

    const res = await request(app)
      .get(BATCHES)
      .query({ programId: programA.id })
      .set('Cookie', cookies);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].programId).toBe(programA.id);
  });
});

describe('PATCH /admin/batches/:id', () => {
  it('rejects a non-existent id with 404', async () => {
    const cookies = await signInAs('admin@example.com', 'admin');
    const res = await request(app)
      .patch(`${BATCHES}/00000000-0000-0000-0000-000000000000`)
      .set('Cookie', cookies)
      .send({ name: 'Renamed' });
    expect(res.status).toBe(404);
  });

  it('updates a batch as admin', async () => {
    const cookies = await signInAs('admin@example.com', 'admin');
    const batch = await createBatchHelper();

    const res = await request(app)
      .patch(`${BATCHES}/${batch.id}`)
      .set('Cookie', cookies)
      .send({ name: '27/28' });

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ name: '27/28' });
  });
});

describe('DELETE /admin/batches/:id', () => {
  it('rejects a non-existent id with 404', async () => {
    const cookies = await signInAs('admin@example.com', 'admin');
    const res = await request(app)
      .delete(`${BATCHES}/00000000-0000-0000-0000-000000000000`)
      .set('Cookie', cookies);
    expect(res.status).toBe(404);
  });

  it('deletes a batch with no students placed under it', async () => {
    const cookies = await signInAs('admin@example.com', 'admin');
    const batch = await createBatchHelper();

    const res = await request(app)
      .delete(`${BATCHES}/${batch.id}`)
      .set('Cookie', cookies);
    expect(res.status).toBe(200);
  });
});

const YEARS = '/api/v1/admin/academic-years';

describe('POST /admin/academic-years', () => {
  it('creates a non-current year by default', async () => {
    const cookies = await signInAs('admin@example.com', 'admin');
    const res = await request(app)
      .post(YEARS)
      .set('Cookie', cookies)
      .send({ name: '2025-2026', startDate: '2025-06-01', endDate: '2026-05-31' });

    expect(res.status).toBe(201);
    expect(res.body.data.isCurrent).toBe(false);
  });

  it('flips the previous current year when a new one is created current', async () => {
    const cookies = await signInAs('admin@example.com', 'admin');
    const yearA = await request(app)
      .post(YEARS)
      .set('Cookie', cookies)
      .send({
        name: '2025-2026',
        startDate: '2025-06-01',
        endDate: '2026-05-31',
        isCurrent: true,
      });
    expect(yearA.body.data.isCurrent).toBe(true);

    const yearB = await request(app)
      .post(YEARS)
      .set('Cookie', cookies)
      .send({
        name: '2026-2027',
        startDate: '2026-06-01',
        endDate: '2027-05-31',
        isCurrent: true,
      });
    expect(yearB.body.data.isCurrent).toBe(true);

    const list = await request(app).get(YEARS).set('Cookie', cookies);
    const current = list.body.data.filter((y: { isCurrent: boolean }) => y.isCurrent);
    expect(current).toHaveLength(1);
    expect(current[0].id).toBe(yearB.body.data.id);
  });
});

describe('PATCH /admin/academic-years/:id', () => {
  it('rejects a non-existent id with 404', async () => {
    const cookies = await signInAs('admin@example.com', 'admin');
    const res = await request(app)
      .patch(`${YEARS}/00000000-0000-0000-0000-000000000000`)
      .set('Cookie', cookies)
      .send({ name: 'Renamed' });
    expect(res.status).toBe(404);
  });

  it('flips the previous current year when isCurrent is set to true', async () => {
    const cookies = await signInAs('admin@example.com', 'admin');
    const yearA = await request(app)
      .post(YEARS)
      .set('Cookie', cookies)
      .send({
        name: '2025-2026',
        startDate: '2025-06-01',
        endDate: '2026-05-31',
        isCurrent: true,
      });
    const yearB = await request(app)
      .post(YEARS)
      .set('Cookie', cookies)
      .send({ name: '2026-2027', startDate: '2026-06-01', endDate: '2027-05-31' });

    const res = await request(app)
      .patch(`${YEARS}/${yearB.body.data.id}`)
      .set('Cookie', cookies)
      .send({ isCurrent: true });
    expect(res.status).toBe(200);
    expect(res.body.data.isCurrent).toBe(true);

    const list = await request(app).get(YEARS).set('Cookie', cookies);
    const current = list.body.data.filter((y: { isCurrent: boolean }) => y.isCurrent);
    expect(current).toHaveLength(1);
    expect(current[0].id).toBe(yearB.body.data.id);
    expect(yearA.body.data.id).not.toBe(current[0].id);
  });
});

describe('DELETE /admin/academic-years/:id', () => {
  it('rejects a non-existent id with 404', async () => {
    const cookies = await signInAs('admin@example.com', 'admin');
    const res = await request(app)
      .delete(`${YEARS}/00000000-0000-0000-0000-000000000000`)
      .set('Cookie', cookies);
    expect(res.status).toBe(404);
  });

  it('deletes an academic year with no sections', async () => {
    const cookies = await signInAs('admin@example.com', 'admin');
    const created = await request(app)
      .post(YEARS)
      .set('Cookie', cookies)
      .send({ name: '2025-2026', startDate: '2025-06-01', endDate: '2026-05-31' });

    const res = await request(app)
      .delete(`${YEARS}/${created.body.data.id}`)
      .set('Cookie', cookies);
    expect(res.status).toBe(200);
  });

  it('rejects deleting an academic year that still has sections with 409', async () => {
    const cookies = await signInAs('admin@example.com', 'admin');
    const { createAcademicYear: createYearHelper, createSection: createSectionHelper } =
      await import('../helpers/institution.js');
    const year = await createYearHelper();
    await createSectionHelper({ academicYearId: year.id });

    const res = await request(app)
      .delete(`${YEARS}/${year.id}`)
      .set('Cookie', cookies);
    expect(res.status).toBe(409);
  });
});

const { createTeacherUser, createClass, createAcademicYear, createStudentUser, createBatch } =
  await import('../helpers/institution.js');

const SECTIONS = '/api/v1/admin/sections';
const CLASS_MEMBERSHIPS = '/api/v1/admin/class-memberships';

describe('POST /admin/sections', () => {
  it('rejects a non-existent classId with 404', async () => {
    const cookies = await signInAs('admin@example.com', 'admin');
    const year = await createAcademicYear();
    const res = await request(app)
      .post(SECTIONS)
      .set('Cookie', cookies)
      .send({
        classId: '00000000-0000-0000-0000-000000000000',
        academicYearId: year.id,
        name: 'A',
      });
    expect(res.status).toBe(404);
  });

  it('rejects a classTeacherId that is not a teacher with 400', async () => {
    const cookies = await signInAs('admin@example.com', 'admin');
    const cls = await createClass();
    const year = await createAcademicYear();
    const notATeacher = await request(app)
      .get('/api/v1/auth/current-user')
      .set('Cookie', await signInAs('student2@example.com', 'student'));

    const res = await request(app)
      .post(SECTIONS)
      .set('Cookie', cookies)
      .send({
        classId: cls.id,
        academicYearId: year.id,
        name: 'A',
        classTeacherId: notATeacher.body.data.id,
      });
    expect(res.status).toBe(400);
  });

  it('creates a section with a valid classTeacherId', async () => {
    const cookies = await signInAs('admin@example.com', 'admin');
    const cls = await createClass();
    const year = await createAcademicYear();
    const teacher = await createTeacherUser();

    const res = await request(app)
      .post(SECTIONS)
      .set('Cookie', cookies)
      .send({
        classId: cls.id,
        academicYearId: year.id,
        name: 'A',
        classTeacherId: teacher.id,
      });

    expect(res.status).toBe(201);
    expect(res.body.data.classTeacherId).toBe(teacher.id);
  });

  it('rejects a duplicate (classId, academicYearId, name) with 400', async () => {
    const cookies = await signInAs('admin@example.com', 'admin');
    const cls = await createClass();
    const year = await createAcademicYear();

    await request(app)
      .post(SECTIONS)
      .set('Cookie', cookies)
      .send({ classId: cls.id, academicYearId: year.id, name: 'A' });

    const res = await request(app)
      .post(SECTIONS)
      .set('Cookie', cookies)
      .send({ classId: cls.id, academicYearId: year.id, name: 'A' });

    expect(res.status).toBe(400);
  });
});

describe('GET /admin/sections', () => {
  it('filters by classId', async () => {
    const cookies = await signInAs('admin@example.com', 'admin');
    const classA = await createClass();
    const classB = await createClass();
    const year = await createAcademicYear();

    await request(app)
      .post(SECTIONS)
      .set('Cookie', cookies)
      .send({ classId: classA.id, academicYearId: year.id, name: 'A' });
    await request(app)
      .post(SECTIONS)
      .set('Cookie', cookies)
      .send({ classId: classB.id, academicYearId: year.id, name: 'A' });

    const res = await request(app)
      .get(SECTIONS)
      .query({ classId: classA.id })
      .set('Cookie', cookies);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].classId).toBe(classA.id);
  });

  it('filters by academicYearId', async () => {
    const cookies = await signInAs('admin@example.com', 'admin');
    const cls = await createClass();
    const yearA = await createAcademicYear({ name: '2025-2026' });
    const yearB = await createAcademicYear({
      name: '2026-2027',
      startDate: '2026-06-01',
      endDate: '2027-05-31',
    });

    await request(app)
      .post(SECTIONS)
      .set('Cookie', cookies)
      .send({ classId: cls.id, academicYearId: yearA.id, name: 'A' });
    await request(app)
      .post(SECTIONS)
      .set('Cookie', cookies)
      .send({ classId: cls.id, academicYearId: yearB.id, name: 'A' });

    const res = await request(app)
      .get(SECTIONS)
      .query({ academicYearId: yearA.id })
      .set('Cookie', cookies);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].academicYearId).toBe(yearA.id);
  });

  it('returns capacity and enrolledCount, counting only active placements', async () => {
    const cookies = await signInAs('admin@example.com', 'admin');
    const cls = await createClass();
    const year = await createAcademicYear();

    const createRes = await request(app)
      .post(SECTIONS)
      .set('Cookie', cookies)
      .send({ classId: cls.id, academicYearId: year.id, name: 'A', capacity: 2 });
    const sectionId: string = createRes.body.data.id;

    const batch = await createBatch({ programId: cls.programId });
    const studentA = await createStudentUser();
    const studentB = await createStudentUser();

    await request(app)
      .post(CLASS_MEMBERSHIPS)
      .set('Cookie', cookies)
      .send({ studentId: studentA.id, sectionId, batchId: batch.id });
    await request(app)
      .post(CLASS_MEMBERSHIPS)
      .set('Cookie', cookies)
      .send({ studentId: studentB.id, sectionId, batchId: batch.id });

    const res = await request(app)
      .get(SECTIONS)
      .query({ classId: cls.id })
      .set('Cookie', cookies);

    expect(res.status).toBe(200);
    const section = (res.body.data as { id: string }[]).find((s) => s.id === sectionId);
    expect(section).toMatchObject({ capacity: 2, enrolledCount: 2 });
  });
});

const { createSection } = await import('../helpers/institution.js');

describe('PATCH /admin/sections/:id', () => {
  it('rejects a non-existent id with 404', async () => {
    const cookies = await signInAs('admin@example.com', 'admin');
    const res = await request(app)
      .patch(`${SECTIONS}/00000000-0000-0000-0000-000000000000`)
      .set('Cookie', cookies)
      .send({ name: 'B' });
    expect(res.status).toBe(404);
  });

  it('rejects a classTeacherId that is not a teacher with 400', async () => {
    const cookies = await signInAs('admin@example.com', 'admin');
    const section = await createSection();
    const notATeacher = await request(app)
      .get('/api/v1/auth/current-user')
      .set('Cookie', await signInAs('notateacher2@example.com', 'student'));

    const res = await request(app)
      .patch(`${SECTIONS}/${section.id}`)
      .set('Cookie', cookies)
      .send({ classTeacherId: notATeacher.body.data.id });
    expect(res.status).toBe(400);
  });

  it('updates a section as admin', async () => {
    const cookies = await signInAs('admin@example.com', 'admin');
    const section = await createSection();
    const teacher = await createTeacherUser();

    const res = await request(app)
      .patch(`${SECTIONS}/${section.id}`)
      .set('Cookie', cookies)
      .send({ name: 'B', classTeacherId: teacher.id });

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ name: 'B', classTeacherId: teacher.id });
  });
});

describe('DELETE /admin/sections/:id', () => {
  it('rejects a non-existent id with 404', async () => {
    const cookies = await signInAs('admin@example.com', 'admin');
    const res = await request(app)
      .delete(`${SECTIONS}/00000000-0000-0000-0000-000000000000`)
      .set('Cookie', cookies);
    expect(res.status).toBe(404);
  });

  it('deletes a section with no students placed in it', async () => {
    const cookies = await signInAs('admin@example.com', 'admin');
    const section = await createSection();

    const res = await request(app)
      .delete(`${SECTIONS}/${section.id}`)
      .set('Cookie', cookies);
    expect(res.status).toBe(200);
  });

  it('rejects deleting a section that still has students placed in it with 409', async () => {
    const cookies = await signInAs('admin@example.com', 'admin');
    const cls = await createClass();
    const section = await createSection({ classId: cls.id });
    const batch = await createBatch({ programId: cls.programId });
    const { classMembershipRepository } = await import(
      '../../src/repositories/classMemberships.repository.js'
    );
    const { createStudentUser } = await import('../helpers/institution.js');
    const student = await createStudentUser();
    await classMembershipRepository.create({
      studentId: student.id,
      batchId: batch.id,
      sectionId: section.id,
      academicYearId: section.academicYearId,
    });

    const res = await request(app)
      .delete(`${SECTIONS}/${section.id}`)
      .set('Cookie', cookies);
    expect(res.status).toBe(409);
  });
});

const COURSES = '/api/v1/admin/courses';

describe('POST /admin/courses', () => {
  it('rejects a non-existent classId with 404', async () => {
    const cookies = await signInAs('admin@example.com', 'admin');
    const res = await request(app)
      .post(COURSES)
      .set('Cookie', cookies)
      .send({
        classId: '00000000-0000-0000-0000-000000000000',
        title: 'Physics',
        code: 'PHYS-101',
      });
    expect(res.status).toBe(404);
  });

  it('creates a course as admin', async () => {
    const cookies = await signInAs('admin@example.com', 'admin');
    const cls = await createClass();
    const res = await request(app)
      .post(COURSES)
      .set('Cookie', cookies)
      .send({ classId: cls.id, title: 'Physics', code: 'PHYS-101' });

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ title: 'Physics', code: 'PHYS-101' });
  });

  it('rejects a duplicate code with 400', async () => {
    const cookies = await signInAs('admin@example.com', 'admin');
    const cls = await createClass();
    await request(app)
      .post(COURSES)
      .set('Cookie', cookies)
      .send({ classId: cls.id, title: 'Physics', code: 'PHYS-101' });

    const res = await request(app)
      .post(COURSES)
      .set('Cookie', cookies)
      .send({ classId: cls.id, title: 'Physics II', code: 'PHYS-101' });

    expect(res.status).toBe(400);
  });
});

describe('GET /admin/courses', () => {
  it('filters by classId', async () => {
    const cookies = await signInAs('admin@example.com', 'admin');
    const classA = await createClass();
    const classB = await createClass();

    await request(app)
      .post(COURSES)
      .set('Cookie', cookies)
      .send({ classId: classA.id, title: 'Physics', code: 'PHYS-101' });
    await request(app)
      .post(COURSES)
      .set('Cookie', cookies)
      .send({ classId: classB.id, title: 'Chemistry', code: 'CHEM-101' });

    const res = await request(app)
      .get(COURSES)
      .query({ classId: classA.id })
      .set('Cookie', cookies);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].title).toBe('Physics');
  });

  it('returns capacity and enrolledCount, counting only active enrollments', async () => {
    const cookies = await signInAs('admin@example.com', 'admin');
    const cls = await createClass();
    const year = await createAcademicYearHelper({ isCurrent: true });

    const courseRes = await request(app)
      .post(COURSES)
      .set('Cookie', cookies)
      .send({
        classId: cls.id,
        title: 'Elective Art',
        code: 'ART-101',
        courseType: 'elective',
        capacity: 1,
      });
    const courseId: string = courseRes.body.data.id;

    const section = await createSection({ classId: cls.id, academicYearId: year.id });
    const batch = await createBatchHelper({ programId: cls.programId });
    const student = await createStudentUser();

    await request(app)
      .post(CLASS_MEMBERSHIPS)
      .set('Cookie', cookies)
      .send({ studentId: student.id, sectionId: section.id, batchId: batch.id });

    await request(app)
      .post('/api/v1/admin/enrollments')
      .set('Cookie', cookies)
      .send({ studentId: student.id, courseId });

    const res = await request(app)
      .get(COURSES)
      .query({ classId: cls.id })
      .set('Cookie', cookies);

    expect(res.status).toBe(200);
    const course = (res.body.data as { id: string }[]).find((c) => c.id === courseId);
    expect(course).toMatchObject({ capacity: 1, enrolledCount: 1 });
  });
});

describe('PATCH /admin/courses/:id', () => {
  it('rejects a non-existent id with 404', async () => {
    const cookies = await signInAs('admin@example.com', 'admin');
    const res = await request(app)
      .patch(`${COURSES}/00000000-0000-0000-0000-000000000000`)
      .set('Cookie', cookies)
      .send({ title: 'Renamed' });
    expect(res.status).toBe(404);
  });

  it('updates a course as admin', async () => {
    const cookies = await signInAs('admin@example.com', 'admin');
    const cls = await createClass();
    const created = await request(app)
      .post(COURSES)
      .set('Cookie', cookies)
      .send({ classId: cls.id, title: 'Physics', code: 'PHYS-101' });

    const res = await request(app)
      .patch(`${COURSES}/${created.body.data.id}`)
      .set('Cookie', cookies)
      .send({ title: 'Physics I', code: 'PHYS-101A' });

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ title: 'Physics I', code: 'PHYS-101A' });
  });

  it('rejects a duplicate code with 400', async () => {
    const cookies = await signInAs('admin@example.com', 'admin');
    const cls = await createClass();
    await request(app)
      .post(COURSES)
      .set('Cookie', cookies)
      .send({ classId: cls.id, title: 'Chemistry', code: 'CHEM-101' });
    const created = await request(app)
      .post(COURSES)
      .set('Cookie', cookies)
      .send({ classId: cls.id, title: 'Physics', code: 'PHYS-101' });

    const res = await request(app)
      .patch(`${COURSES}/${created.body.data.id}`)
      .set('Cookie', cookies)
      .send({ code: 'CHEM-101' });
    expect(res.status).toBe(400);
  });
});

describe('DELETE /admin/courses/:id', () => {
  it('rejects a non-existent id with 404', async () => {
    const cookies = await signInAs('admin@example.com', 'admin');
    const res = await request(app)
      .delete(`${COURSES}/00000000-0000-0000-0000-000000000000`)
      .set('Cookie', cookies);
    expect(res.status).toBe(404);
  });

  it('deletes a course and cascades its teacher assignments and enrollments', async () => {
    const cookies = await signInAs('admin@example.com', 'admin');
    const { createCourse: createCourseHelper, createEnrollment, createTeacherUser: createTeacher } =
      await import('../helpers/institution.js');
    const course = await createCourseHelper();
    const teacher = await createTeacher();
    await request(app)
      .post(`${COURSES}/${course.id}/teachers`)
      .set('Cookie', cookies)
      .send({ teacherId: teacher.id });
    await createEnrollment({ courseId: course.id });

    const res = await request(app)
      .delete(`${COURSES}/${course.id}`)
      .set('Cookie', cookies);
    expect(res.status).toBe(200);

    const list = await request(app).get(COURSES).set('Cookie', cookies);
    expect(list.body.data).toHaveLength(0);
  });
});

const { createCourse } = await import('../helpers/institution.js');

const COURSE_TEACHERS = (courseId: string) =>
  `/api/v1/admin/courses/${courseId}/teachers`;

describe('POST /admin/courses/:courseId/teachers', () => {
  it('rejects a non-existent courseId with 404', async () => {
    const cookies = await signInAs('admin@example.com', 'admin');
    const teacher = await createTeacherUser();
    const res = await request(app)
      .post(COURSE_TEACHERS('00000000-0000-0000-0000-000000000000'))
      .set('Cookie', cookies)
      .send({ teacherId: teacher.id });
    expect(res.status).toBe(404);
  });

  it('rejects a non-existent teacherId with 404', async () => {
    const cookies = await signInAs('admin@example.com', 'admin');
    const course = await createCourse();
    const res = await request(app)
      .post(COURSE_TEACHERS(course.id))
      .set('Cookie', cookies)
      .send({ teacherId: '00000000-0000-0000-0000-000000000000' });
    expect(res.status).toBe(404);
  });

  it('rejects a teacherId that is not a teacher with 400', async () => {
    const cookies = await signInAs('admin@example.com', 'admin');
    const course = await createCourse();
    const notATeacher = await request(app)
      .get('/api/v1/auth/current-user')
      .set('Cookie', await signInAs('notateacher@example.com', 'student'));

    const res = await request(app)
      .post(COURSE_TEACHERS(course.id))
      .set('Cookie', cookies)
      .send({ teacherId: notATeacher.body.data.id });
    expect(res.status).toBe(400);
  });

  it('assigns a teacher to a course', async () => {
    const cookies = await signInAs('admin@example.com', 'admin');
    const course = await createCourse();
    const teacher = await createTeacherUser();

    const res = await request(app)
      .post(COURSE_TEACHERS(course.id))
      .set('Cookie', cookies)
      .send({ teacherId: teacher.id });

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      courseId: course.id,
      teacherId: teacher.id,
      teacherName: teacher.name,
    });
  });

  it('rejects assigning the same teacher to the same course twice with 400', async () => {
    const cookies = await signInAs('admin@example.com', 'admin');
    const course = await createCourse();
    const teacher = await createTeacherUser();

    await request(app)
      .post(COURSE_TEACHERS(course.id))
      .set('Cookie', cookies)
      .send({ teacherId: teacher.id });

    const res = await request(app)
      .post(COURSE_TEACHERS(course.id))
      .set('Cookie', cookies)
      .send({ teacherId: teacher.id });

    expect(res.status).toBe(400);
  });
});

describe('GET /admin/courses/:courseId/teachers', () => {
  it('lists assigned teachers with name and email', async () => {
    const cookies = await signInAs('admin@example.com', 'admin');
    const course = await createCourse();
    const teacher = await createTeacherUser({ name: 'Ada Lovelace' });
    await request(app)
      .post(COURSE_TEACHERS(course.id))
      .set('Cookie', cookies)
      .send({ teacherId: teacher.id });

    const res = await request(app)
      .get(COURSE_TEACHERS(course.id))
      .set('Cookie', cookies);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].teacherName).toBe('Ada Lovelace');
  });
});
