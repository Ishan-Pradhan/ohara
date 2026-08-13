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
  const batch = await createBatch({ programId: cls.programId });
  const section = await createSection({ classId: cls.id, batchId: batch.id });
  const course = await createCourse({ classId: cls.id });
  const teacher = await createTeacherUser({ email: `teacher-${Date.now()}@example.com` });
  await courseTeacherRepository.assign({ teacherId: teacher.id, courseId: course.id });
  const student = await createStudentUser({ email: `student-${Date.now()}@example.com` });
  await classMembershipRepository.create(
    { studentId: student.id, sectionId: section.id, batchId: batch.id, classId: cls.id },
    [course.id],
  );

  const teacherCookies = await signInAs(teacher.email, 'teacher');
  const studentCookies = await signInAs(student.email, 'student');
  return { course, section, cls, batch, teacher, student, teacherCookies, studentCookies };
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
    const { course, section, cls, batch, teacherCookies } = await setupCourseWithTeacherAndStudent();
    const otherSection = await createSection({ classId: cls.id, batchId: batch.id, name: 'B' });

    const res = await request(app)
      .get(`/api/v1/courses/${course.id}/attendance/sections`)
      .set('Cookie', teacherCookies);
    expect(res.status).toBe(200);
    expect(new Set(res.body.data.map((s: { id: string }) => s.id))).toEqual(
      new Set([section.id, otherSection.id]),
    );
  });

  it('prefers a populated batch\'s section over an empty batch\'s section sharing the same name', async () => {
    // Reproduces a real production case: a class ends up with two "Section
    // A" rows — one under a batch that was created but never actually
    // populated, and one under the batch that actually holds the class's
    // enrolled student. The take-attendance picker must resolve to the
    // section with the student, purely from who's structurally enrolled —
    // no "current" flag involved at all.
    const program = await createProgram();
    const cls = await createClass({ programId: program.id });
    const course = await createCourse({ classId: cls.id });
    const teacher = await createTeacherUser({ email: `teacher-${Date.now()}@example.com` });
    await courseTeacherRepository.assign({ teacherId: teacher.id, courseId: course.id });

    const emptyBatch = await createBatch({ programId: program.id, name: 'Empty' });
    const populatedBatch = await createBatch({ programId: program.id, name: 'Populated' });

    // Empty section — never populated.
    const emptySection = await createSection({ classId: cls.id, batchId: emptyBatch.id, name: 'A' });
    // Populated section under a different batch.
    const populatedSection = await createSection({ classId: cls.id, batchId: populatedBatch.id, name: 'A' });
    const student = await createStudentUser({ email: `promoted-${Date.now()}@example.com` });
    await classMembershipRepository.create(
      { studentId: student.id, sectionId: populatedSection.id, batchId: populatedBatch.id, classId: cls.id },
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

  it('scopes the whole-course attendance summary to the current batch — a past batch\'s leftover enrollment and its attendance never show up', async () => {
    // Reproduces a real report: a course reused across batches leaves every
    // past student's Enrollment row sitting at status 'active' forever
    // (nothing marks it inactive when a batch moves on), so a naive
    // "every enrollment for this course" query for the whole-course summary
    // (no sectionId — e.g. an "all sections" view) pulls in a graduated
    // batch's attendance right alongside the real current roster. What
    // actually decides "current" is the ClassMembership outcome, not the
    // Enrollment status.
    const cls = await createClass();
    const oldBatch = await createBatch({ programId: cls.programId, name: '24/25' });
    const currentBatch = await createBatch({ programId: cls.programId, name: '25/26' });
    const oldSection = await createSection({ classId: cls.id, batchId: oldBatch.id, name: 'A' });
    const currentSection = await createSection({ classId: cls.id, batchId: currentBatch.id, name: 'A' });
    const course = await createCourse({ classId: cls.id });
    const teacher = await createTeacherUser({ email: `teacher-${Date.now()}@example.com` });
    await courseTeacherRepository.assign({ teacherId: teacher.id, courseId: course.id });

    const pastStudent = await createStudentUser({ email: `past-${Date.now()}@example.com` });
    const pastMembership = await classMembershipRepository.create(
      { studentId: pastStudent.id, sectionId: oldSection.id, batchId: oldBatch.id, classId: cls.id },
      [course.id],
    );

    const currentStudent = await createStudentUser({ email: `current-${Date.now()}@example.com` });
    await classMembershipRepository.create(
      { studentId: currentStudent.id, sectionId: currentSection.id, batchId: currentBatch.id, classId: cls.id },
      [course.id],
    );

    const teacherCookies = await signInAs(teacher.email, 'teacher');

    // Real attendance was legitimately taken for the past student, back
    // when their section was the live one (and they were still 'enrolled').
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

    // Simulate the old batch moving on — their ClassMembership is no longer
    // 'enrolled' (graduated out), even though their course Enrollment row
    // (created above via auto-enroll) is left at 'active' forever.
    await classMembershipRepository.graduate(pastMembership.id, pastStudent.id);

    const summaryRes = await request(app)
      .get(`/api/v1/courses/${course.id}/attendance/summary`)
      .set('Cookie', teacherCookies);
    expect(summaryRes.status).toBe(200);
    const studentIds = summaryRes.body.data.map((r: { studentId: string }) => r.studentId);
    expect(studentIds).toEqual([currentStudent.id]);
    expect(studentIds).not.toContain(pastStudent.id);

    // The whole-course sessions list must also exclude the old batch's
    // session, not just the per-student summary — a sibling endpoint with
    // the identical unscoped bug.
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

  it('shows nothing when a class has sections but no batch has ever been placed in any of them', async () => {
    const program = await createProgram();
    const cls = await createClass({ programId: program.id });
    const course = await createCourse({ classId: cls.id });
    const teacher = await createTeacherUser({ email: `teacher-${Date.now()}@example.com` });
    await courseTeacherRepository.assign({ teacherId: teacher.id, courseId: course.id });

    const batch = await createBatch({ programId: program.id });
    await createSection({ classId: cls.id, batchId: batch.id, name: 'A' });

    const teacherCookies = await signInAs(teacher.email, 'teacher');

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
    const batch = await createBatch({ programId: cls.programId });
    const sectionA = await createSection({ classId: cls.id, batchId: batch.id, name: 'A' });
    const sectionB = await createSection({ classId: cls.id, batchId: batch.id, name: 'B' });
    const course = await createCourse({ classId: cls.id });
    const teacher = await createTeacherUser({ email: `teacher-${Date.now()}@example.com` });
    await courseTeacherRepository.assign({ teacherId: teacher.id, courseId: course.id });

    const studentA = await createStudentUser({ email: `a-${Date.now()}@example.com` });
    await classMembershipRepository.create(
      { studentId: studentA.id, sectionId: sectionA.id, batchId: batch.id, classId: cls.id },
      [course.id],
    );
    const studentB = await createStudentUser({ email: `b-${Date.now()}@example.com` });
    await classMembershipRepository.create(
      { studentId: studentB.id, sectionId: sectionB.id, batchId: batch.id, classId: cls.id },
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

  it('keeps a since-departed student\'s attendance visible when their old section is explicitly picked, but whole-course mode still resolves to the current section', async () => {
    // Reproduces a real case: attendance was taken while the student was
    // genuinely there, then they were promoted to the next semester (a
    // normal end-of-term action). A Section is permanently tied to one
    // (class, batch) cohort and is never reused by a later intake, so once
    // its own sectionId is explicitly picked there's no "mixing cohorts"
    // risk — that history should stay fully visible (fixed 2026-08-13,
    // this used to also narrow to *currently*-enrolled students, silently
    // emptying a promoted-out section's entire history). Whole-course mode
    // (no sectionId — genuinely ambiguous across every batch that's ever
    // taken this course) still resolves to whichever batch/section is
    // current right now, which has no attendance of its own here.
    const program = await createProgram();
    const cls = await createClass({ programId: program.id, orderIndex: 1 });
    const nextCls = await createClass({ programId: program.id, orderIndex: 2 });
    const batch = await createBatch({ programId: program.id });
    const section = await createSection({ classId: cls.id, batchId: batch.id, name: 'A' });
    const nextSection = await createSection({ classId: nextCls.id, batchId: batch.id, name: 'A' });
    const course = await createCourse({ classId: cls.id });
    const teacher = await createTeacherUser({ email: `teacher-${Date.now()}@example.com` });
    await courseTeacherRepository.assign({ teacherId: teacher.id, courseId: course.id });

    const student = await createStudentUser({ email: `promoted-${Date.now()}@example.com` });
    const membership = await classMembershipRepository.create(
      { studentId: student.id, sectionId: section.id, batchId: batch.id, classId: cls.id },
      [course.id],
    );

    const teacherCookies = await signInAs(teacher.email, 'teacher');
    await request(app)
      .post(`/api/v1/courses/${course.id}/attendance/sessions`)
      .set('Cookie', teacherCookies)
      .send({ sectionId: section.id, sessionDate: '2026-08-10', records: [{ studentId: student.id, status: 'present' }] });

    // Promote the student out of `section` into `nextSection` — a normal
    // end-of-term action that flips the old membership's outcome away from
    // 'enrolled' while its attendance history stays exactly as it was. Batch
    // never changes on promotion.
    await classMembershipRepository.promote(
      membership.id,
      { studentId: student.id, sectionId: nextSection.id, batchId: batch.id, classId: nextCls.id },
      'promoted',
    );

    const sectionScoped = await request(app)
      .get(`/api/v1/courses/${course.id}/attendance-trends?sectionId=${section.id}`)
      .set('Cookie', teacherCookies);
    expect(sectionScoped.status).toBe(200);
    expect(sectionScoped.body.data).toEqual([
      { date: '2026-08-10', present: 1, absent: 0, late: 0, total: 1 },
    ]);

    const wholeCourse = await request(app)
      .get(`/api/v1/courses/${course.id}/attendance-trends`)
      .set('Cookie', teacherCookies);
    expect(wholeCourse.status).toBe(200);
    expect(wholeCourse.body.data).toEqual([]);

    // The sessions list mirrors the same split.
    const sectionScopedSessions = await request(app)
      .get(`/api/v1/courses/${course.id}/attendance/sessions?sectionId=${section.id}`)
      .set('Cookie', teacherCookies);
    expect(sectionScopedSessions.status).toBe(200);
    expect(sectionScopedSessions.body.data).toHaveLength(1);
    expect(sectionScopedSessions.body.data[0]).toMatchObject({ sessionDate: '2026-08-10' });

    const wholeCourseSessions = await request(app)
      .get(`/api/v1/courses/${course.id}/attendance/sessions`)
      .set('Cookie', teacherCookies);
    expect(wholeCourseSessions.status).toBe(200);
    expect(wholeCourseSessions.body.data).toEqual([]);

    // The section's own roster/summary also stay visible when it's
    // explicitly picked — this is the same "viewing completed-course
    // history" fix, applied consistently across roster/summary/sessions/
    // trends. See docs/superpowers/specs/2026-08-13-completed-course-history-design.md.
    const rosterRes = await request(app)
      .get(`/api/v1/courses/${course.id}/attendance/roster?sectionId=${section.id}`)
      .set('Cookie', teacherCookies);
    expect(rosterRes.status).toBe(200);
    expect(rosterRes.body.data).toEqual([{ studentId: student.id, studentName: student.name }]);

    const summaryRes = await request(app)
      .get(`/api/v1/courses/${course.id}/attendance/summary?sectionId=${section.id}`)
      .set('Cookie', teacherCookies);
    expect(summaryRes.status).toBe(200);
    expect(summaryRes.body.data).toEqual([
      { studentId: student.id, studentName: student.name, present: 1, absent: 0, late: 0, total: 1, percentage: 100 },
    ]);
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
    const { course, section, cls, batch, teacherCookies, student } =
      await setupCourseWithTeacherAndStudent();

    const otherSection = await createSection({ classId: cls.id, batchId: batch.id, name: 'B' });
    const otherStudent = await createStudentUser({ email: `other-section-${Date.now()}@example.com` });
    await classMembershipRepository.create(
      { studentId: otherStudent.id, sectionId: otherSection.id, batchId: batch.id, classId: cls.id },
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
