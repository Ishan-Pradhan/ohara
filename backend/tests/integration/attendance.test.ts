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

  it('prefers a populated section over an empty one marked "current", when a class has same-named sections across two years', async () => {
    // Reproduces a real production case: a university's odd-term class ends
    // up with two "Section A" rows — one under the academic year still
    // flagged is_current (created early, never actually populated) and one
    // under the year that actually holds the class's promoted, enrolled
    // student (not yet flagged current because the admin hasn't advanced it
    // forward). The take-attendance picker must resolve to the section with
    // the student, not the empty "current" one.
    const program = await createProgram({ institutionType: 'university' });
    const cls = await createClass({ programId: program.id, orderIndex: 3 }); // odd term (3 is odd)
    const course = await createCourse({ classId: cls.id });
    const teacher = await createTeacherUser({ email: `teacher-${Date.now()}@example.com` });
    await courseTeacherRepository.assign({ teacherId: teacher.id, courseId: course.id });

    const staleCurrentYear = await createAcademicYear({
      name: '2026 odd',
      term: 'odd',
      isCurrent: true,
      startDate: '2026-01-01',
      endDate: '2026-12-31',
    });
    const realYear = await createAcademicYear({
      name: '2027 odd',
      term: 'odd',
      isCurrent: false,
      startDate: '2027-01-01',
      endDate: '2027-12-31',
    });

    // Empty section under the stale "current" year — never populated.
    const emptySection = await createSection({ classId: cls.id, academicYearId: staleCurrentYear.id, name: 'A' });
    // Populated section under the real (non-current) year.
    const populatedSection = await createSection({ classId: cls.id, academicYearId: realYear.id, name: 'A' });
    const batch = await createBatch({ programId: program.id, startAcademicYearId: staleCurrentYear.id });
    const student = await createStudentUser({ email: `promoted-${Date.now()}@example.com` });
    await classMembershipRepository.create(
      { studentId: student.id, sectionId: populatedSection.id, batchId: batch.id, academicYearId: realYear.id },
      [course.id],
    );

    const teacherCookies = await signInAs(teacher.email, 'teacher');
    const res = await request(app)
      .get(`/api/v1/courses/${course.id}/attendance/sections`)
      .set('Cookie', teacherCookies);

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([{ id: populatedSection.id, name: 'A' }]);
    expect(res.body.data.map((s: { id: string }) => s.id)).not.toContain(emptySection.id);
  });

  it('scopes the whole-course attendance summary to the current year — a past batch\'s leftover enrollment and its attendance never show up', async () => {
    // Reproduces a real report: a course reused across batches leaves every
    // past student's Enrollment row sitting at status 'active' forever
    // (nothing marks it inactive when a batch moves on), so a naive
    // "every enrollment for this course" query for the whole-course summary
    // (no sectionId — e.g. an "all sections" view) pulls in a graduated
    // batch's attendance right alongside the real current roster, even when
    // the current year's own section is otherwise empty of them.
    const cls = await createClass();
    const oldYear = await createAcademicYear({
      name: '2024-2025',
      term: 'annual',
      isCurrent: false,
      startDate: '2024-06-01',
      endDate: '2025-05-31',
    });
    const currentYear = await createAcademicYear({
      name: '2025-2026',
      term: 'annual',
      isCurrent: true,
      startDate: '2025-06-01',
      endDate: '2026-05-31',
    });
    const oldSection = await createSection({ classId: cls.id, academicYearId: oldYear.id, name: 'A' });
    const currentSection = await createSection({ classId: cls.id, academicYearId: currentYear.id, name: 'A' });
    const course = await createCourse({ classId: cls.id });
    const teacher = await createTeacherUser({ email: `teacher-${Date.now()}@example.com` });
    await courseTeacherRepository.assign({ teacherId: teacher.id, courseId: course.id });

    const oldBatch = await createBatch({ programId: cls.programId, name: '24/25', startAcademicYearId: oldYear.id });
    const pastStudent = await createStudentUser({ email: `past-${Date.now()}@example.com` });
    await classMembershipRepository.create(
      { studentId: pastStudent.id, sectionId: oldSection.id, batchId: oldBatch.id, academicYearId: oldYear.id },
      [course.id],
    );

    const currentBatch = await createBatch({ programId: cls.programId, name: '25/26', startAcademicYearId: currentYear.id });
    const currentStudent = await createStudentUser({ email: `current-${Date.now()}@example.com` });
    await classMembershipRepository.create(
      { studentId: currentStudent.id, sectionId: currentSection.id, batchId: currentBatch.id, academicYearId: currentYear.id },
      [course.id],
    );

    const teacherCookies = await signInAs(teacher.email, 'teacher');

    // Real attendance was legitimately taken for the past student, back
    // when their section was the live one.
    const oldSessionRes = await request(app)
      .post(`/api/v1/courses/${course.id}/attendance/sessions`)
      .set('Cookie', teacherCookies)
      .send({
        sectionId: oldSection.id,
        sessionDate: '2025-01-10',
        records: [{ studentId: pastStudent.id, status: 'present' }],
      });
    const currentSessionRes = await request(app)
      .post(`/api/v1/courses/${course.id}/attendance/sessions`)
      .set('Cookie', teacherCookies)
      .send({
        sectionId: currentSection.id,
        sessionDate: '2025-09-10',
        records: [{ studentId: currentStudent.id, status: 'present' }],
      });

    const summaryRes = await request(app)
      .get(`/api/v1/courses/${course.id}/attendance/summary`)
      .set('Cookie', teacherCookies);
    expect(summaryRes.status).toBe(200);
    const studentIds = summaryRes.body.data.map((r: { studentId: string }) => r.studentId);
    expect(studentIds).toEqual([currentStudent.id]);
    expect(studentIds).not.toContain(pastStudent.id);

    // The whole-course sessions list must also exclude the old batch's
    // session, not just the per-student summary — a sibling endpoint with
    // the identical unscoped-by-year bug.
    const sessionsRes = await request(app)
      .get(`/api/v1/courses/${course.id}/attendance/sessions`)
      .set('Cookie', teacherCookies);
    expect(sessionsRes.status).toBe(200);
    const sessionIds = sessionsRes.body.data.map((s: { id: string }) => s.id);
    expect(sessionIds).toEqual([currentSessionRes.body.data.id]);
    expect(sessionIds).not.toContain(oldSessionRes.body.data.id);

    // And the trends chart — same bug, third sibling.
    const trendsRes = await request(app)
      .get(`/api/v1/courses/${course.id}/attendance-trends`)
      .set('Cookie', teacherCookies);
    expect(trendsRes.status).toBe(200);
    expect(trendsRes.body.data).toEqual([{ date: '2025-09-10', present: 1, absent: 0, late: 0, total: 1 }]);
  });

  it('does not fall back to a stale, never-promoted-out cohort from an older year when the current term is genuinely empty', async () => {
    // Distinguishes two look-alike cases that both present as "current
    // year's section has 0 currently-enrolled students": (a) the isCurrent
    // flag just hasn't been advanced yet and the real cohort is in a NEWER
    // year (covered by the test above — must still resolve to that newer
    // year), vs (b) a class_membership row was simply never updated away
    // from outcome: 'enrolled' when an OLDER cohort moved on, and the
    // current term genuinely has nobody placed in it yet. Case (b) must
    // show empty, not the stale older cohort's attendance.
    const program = await createProgram();
    const cls = await createClass({ programId: program.id });
    const course = await createCourse({ classId: cls.id });
    const teacher = await createTeacherUser({ email: `teacher-${Date.now()}@example.com` });
    await courseTeacherRepository.assign({ teacherId: teacher.id, courseId: course.id });

    const oldYear = await createAcademicYear({
      name: '2023-2024',
      term: 'annual',
      isCurrent: false,
      startDate: '2023-06-01',
      endDate: '2024-05-31',
    });
    const currentYear = await createAcademicYear({
      name: '2026-2027',
      term: 'annual',
      isCurrent: true,
      startDate: '2026-06-01',
      endDate: '2027-05-31',
    });
    const oldSection = await createSection({ classId: cls.id, academicYearId: oldYear.id, name: 'A' });
    // Current year has a section, but nobody has ever been placed in it.
    await createSection({ classId: cls.id, academicYearId: currentYear.id, name: 'A' });

    const oldBatch = await createBatch({ programId: program.id, startAcademicYearId: oldYear.id });
    const staleStudent = await createStudentUser({ email: `stale-${Date.now()}@example.com` });
    // Left at outcome: 'enrolled' forever — nobody ever ran promote/graduate for them.
    await classMembershipRepository.create(
      { studentId: staleStudent.id, sectionId: oldSection.id, batchId: oldBatch.id, academicYearId: oldYear.id },
      [course.id],
    );

    const teacherCookies = await signInAs(teacher.email, 'teacher');
    await request(app)
      .post(`/api/v1/courses/${course.id}/attendance/sessions`)
      .set('Cookie', teacherCookies)
      .send({
        sectionId: oldSection.id,
        sessionDate: '2023-09-10',
        records: [{ studentId: staleStudent.id, status: 'present' }],
      });

    const summaryRes = await request(app)
      .get(`/api/v1/courses/${course.id}/attendance/summary`)
      .set('Cookie', teacherCookies);
    expect(summaryRes.status).toBe(200);
    expect(summaryRes.body.data).toEqual([]);

    const sessionsRes = await request(app)
      .get(`/api/v1/courses/${course.id}/attendance/sessions`)
      .set('Cookie', teacherCookies);
    expect(sessionsRes.status).toBe(200);
    expect(sessionsRes.body.data).toEqual([]);

    const trendsRes = await request(app)
      .get(`/api/v1/courses/${course.id}/attendance-trends`)
      .set('Cookie', teacherCookies);
    expect(trendsRes.status).toBe(200);
    expect(trendsRes.body.data).toEqual([]);
  });

  it('scopes attendance trends to one section when ?sectionId= is given', async () => {
    const cls = await createClass();
    const year = await createAcademicYear({ isCurrent: true, term: 'annual' });
    const sectionA = await createSection({ classId: cls.id, academicYearId: year.id, name: 'A' });
    const sectionB = await createSection({ classId: cls.id, academicYearId: year.id, name: 'B' });
    const course = await createCourse({ classId: cls.id });
    const teacher = await createTeacherUser({ email: `teacher-${Date.now()}@example.com` });
    await courseTeacherRepository.assign({ teacherId: teacher.id, courseId: course.id });

    const batch = await createBatch({ programId: cls.programId, startAcademicYearId: year.id });
    const studentA = await createStudentUser({ email: `a-${Date.now()}@example.com` });
    await classMembershipRepository.create(
      { studentId: studentA.id, sectionId: sectionA.id, batchId: batch.id, academicYearId: year.id },
      [course.id],
    );
    const studentB = await createStudentUser({ email: `b-${Date.now()}@example.com` });
    await classMembershipRepository.create(
      { studentId: studentB.id, sectionId: sectionB.id, batchId: batch.id, academicYearId: year.id },
      [course.id],
    );

    const teacherCookies = await signInAs(teacher.email, 'teacher');
    await request(app)
      .post(`/api/v1/courses/${course.id}/attendance/sessions`)
      .set('Cookie', teacherCookies)
      .send({ sectionId: sectionA.id, sessionDate: '2026-09-10', records: [{ studentId: studentA.id, status: 'present' }] });
    await request(app)
      .post(`/api/v1/courses/${course.id}/attendance/sessions`)
      .set('Cookie', teacherCookies)
      .send({ sectionId: sectionB.id, sessionDate: '2026-09-11', records: [{ studentId: studentB.id, status: 'absent' }] });

    const res = await request(app)
      .get(`/api/v1/courses/${course.id}/attendance-trends?sectionId=${sectionA.id}`)
      .set('Cookie', teacherCookies);

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([{ date: '2026-09-10', present: 1, absent: 0, late: 0, total: 1 }]);
  });

  it('excludes a since-departed student\'s attendance from both the trends chart and the sessions list, section-scoped and whole-course', async () => {
    // Reproduces a real case: attendance was taken while the student was
    // genuinely there, then they were promoted to the next semester (a
    // normal end-of-term action) — that history is correct, but it must
    // stop counting toward the section's *current* trend chart, the same
    // way getAttendanceSummary already excludes them from the roster.
    // Otherwise the chart contradicts the (now-empty) summary table, and
    // reusing this section for a new intake later would mix cohorts.
    const program = await createProgram();
    const cls = await createClass({ programId: program.id, orderIndex: 1 });
    const nextCls = await createClass({ programId: program.id, orderIndex: 2 });
    const year = await createAcademicYear({
      name: '2025-2026', term: 'annual', isCurrent: false, startDate: '2025-06-01', endDate: '2026-05-31',
    });
    const nextYear = await createAcademicYear({
      name: '2026-2027', term: 'annual', isCurrent: true, startDate: '2026-06-01', endDate: '2027-05-31',
    });
    const section = await createSection({ classId: cls.id, academicYearId: year.id, name: 'A' });
    const nextSection = await createSection({ classId: nextCls.id, academicYearId: nextYear.id, name: 'A' });
    const course = await createCourse({ classId: cls.id });
    const teacher = await createTeacherUser({ email: `teacher-${Date.now()}@example.com` });
    await courseTeacherRepository.assign({ teacherId: teacher.id, courseId: course.id });

    const batch = await createBatch({ programId: program.id, startAcademicYearId: year.id });
    const student = await createStudentUser({ email: `promoted-${Date.now()}@example.com` });
    const membership = await classMembershipRepository.create(
      { studentId: student.id, sectionId: section.id, batchId: batch.id, academicYearId: year.id },
      [course.id],
    );

    const teacherCookies = await signInAs(teacher.email, 'teacher');
    await request(app)
      .post(`/api/v1/courses/${course.id}/attendance/sessions`)
      .set('Cookie', teacherCookies)
      .send({ sectionId: section.id, sessionDate: '2026-08-10', records: [{ studentId: student.id, status: 'present' }] });

    // Promote the student out of `section` into `nextSection` — a normal
    // end-of-term action that flips the old membership's outcome away from
    // 'enrolled' while its attendance history stays exactly as it was.
    await classMembershipRepository.promote(
      membership.id,
      { studentId: student.id, sectionId: nextSection.id, batchId: batch.id, academicYearId: nextYear.id },
      'promoted',
    );

    const sectionScoped = await request(app)
      .get(`/api/v1/courses/${course.id}/attendance-trends?sectionId=${section.id}`)
      .set('Cookie', teacherCookies);
    expect(sectionScoped.status).toBe(200);
    expect(sectionScoped.body.data).toEqual([]);

    const wholeCourse = await request(app)
      .get(`/api/v1/courses/${course.id}/attendance-trends`)
      .set('Cookie', teacherCookies);
    expect(wholeCourse.status).toBe(200);
    expect(wholeCourse.body.data).toEqual([]);

    // The sessions list has the identical contradiction — the date entry
    // itself would still show up for a section the summary/roster already
    // say has nobody in it.
    const sectionScopedSessions = await request(app)
      .get(`/api/v1/courses/${course.id}/attendance/sessions?sectionId=${section.id}`)
      .set('Cookie', teacherCookies);
    expect(sectionScopedSessions.status).toBe(200);
    expect(sectionScopedSessions.body.data).toEqual([]);

    const wholeCourseSessions = await request(app)
      .get(`/api/v1/courses/${course.id}/attendance/sessions`)
      .set('Cookie', teacherCookies);
    expect(wholeCourseSessions.status).toBe(200);
    expect(wholeCourseSessions.body.data).toEqual([]);
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
      { studentId: student.id, studentName: student.name, status: 'present', reason: null },
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
