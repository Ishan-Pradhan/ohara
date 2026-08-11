import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import request from 'supertest';

vi.mock('../../src/services/email.service.js', async () => {
  const { emailServiceStub } = await import('../helpers/auth.js');
  return emailServiceStub();
});

vi.mock('../../src/services/llm.service.js', () => ({
  generateJson: vi.fn(),
}));

const { app } = await import('../../src/app.js');
const { truncateAll, closeDb } = await import('../helpers/db.js');
const { cookiesFrom } = await import('../helpers/auth.js');
const { User } = await import('../../src/models/users.model.js');
const {
  createCourse,
  createTeacherUser,
  createStudentUser,
  createEnrollment,
  createAcademicYear,
} = await import('../helpers/institution.js');
const { courseTeacherRepository } = await import(
  '../../src/repositories/courseTeachers.repository.js'
);
const { generateJson } = await import('../../src/services/llm.service.js');

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

beforeEach(async () => {
  await truncateAll();
  vi.mocked(generateJson).mockReset();
});

afterAll(async () => {
  await closeDb();
});

describe('Gradebook', () => {
  it('aggregates approved assignment grades and quiz attempts into the class matrix and per-student view', async () => {
    await createAcademicYear({ isCurrent: true });
    const course = await createCourse();
    const teacher = await createTeacherUser({ email: `teacher-${Date.now()}@example.com` });
    await courseTeacherRepository.assign({ teacherId: teacher.id, courseId: course.id });
    const teacherCookies = await signInAs(teacher.email, 'teacher');

    const student1 = await createStudentUser({ email: `s1-${Date.now()}@example.com` });
    const student2 = await createStudentUser({ email: `s2-${Date.now()}@example.com` });
    const student3 = await createStudentUser({ email: `s3-${Date.now()}@example.com` });
    await createEnrollment({ studentId: student1.id, courseId: course.id });
    await createEnrollment({ studentId: student2.id, courseId: course.id });
    await createEnrollment({ studentId: student3.id, courseId: course.id });
    const student1Cookies = await signInAs(student1.email, 'student');
    const student2Cookies = await signInAs(student2.email, 'student');

    // Assignment worth 10 points total.
    const assignmentRes = await request(app)
      .post(`/api/v1/courses/${course.id}/assignments`)
      .set('Cookie', teacherCookies)
      .send({
        title: 'Essay',
        prompt: 'Write something.',
        rubric: [{ criterion: 'Quality', maxPoints: 10 }],
        dueAt: new Date(Date.now() + 3600_000).toISOString(),
      });
    const assignmentId = assignmentRes.body.data.id;

    // student1 submits, gets AI-graded, then approved at 8/10.
    await request(app)
      .post(`/api/v1/courses/${course.id}/assignments/${assignmentId}/submissions`)
      .set('Cookie', student1Cookies)
      .field('content', 'My essay.');
    // student2 submits but is left in draft (pending review).
    await request(app)
      .post(`/api/v1/courses/${course.id}/assignments/${assignmentId}/submissions`)
      .set('Cookie', student2Cookies)
      .field('content', 'Another essay.');
    // student3 never submits.

    const submissionsRes = await request(app)
      .get(`/api/v1/courses/${course.id}/assignments/${assignmentId}/submissions`)
      .set('Cookie', teacherCookies);
    const sub1 = submissionsRes.body.data.find((s: { studentId: string }) => s.studentId === student1.id);
    const sub2 = submissionsRes.body.data.find((s: { studentId: string }) => s.studentId === student2.id);

    vi.mocked(generateJson).mockResolvedValueOnce(
      JSON.stringify({
        criterionFeedback: [{ criterion: 'Quality', awardedPoints: 8, feedback: 'Good.' }],
        overallFeedback: 'Solid.',
      }),
    );
    await request(app)
      .post(`/api/v1/courses/${course.id}/assignments/${assignmentId}/submissions/${sub1.id}/grade`)
      .set('Cookie', teacherCookies);
    await request(app)
      .patch(`/api/v1/courses/${course.id}/assignments/${assignmentId}/submissions/${sub1.id}/grade`)
      .set('Cookie', teacherCookies)
      .send({
        criterionFeedback: [{ criterion: 'Quality', maxPoints: 10, awardedPoints: 8, feedback: 'Good.' }],
        status: 'approved',
      });

    vi.mocked(generateJson).mockResolvedValueOnce(
      JSON.stringify({
        criterionFeedback: [{ criterion: 'Quality', awardedPoints: 6, feedback: 'Okay.' }],
        overallFeedback: 'Needs work.',
      }),
    );
    await request(app)
      .post(`/api/v1/courses/${course.id}/assignments/${assignmentId}/submissions/${sub2.id}/grade`)
      .set('Cookie', teacherCookies);
    // sub2 stays draft — never approved.

    // Quiz worth 1 point (single mcq), published.
    const quizRes = await request(app)
      .post(`/api/v1/courses/${course.id}/quizzes`)
      .set('Cookie', teacherCookies)
      .send({ title: 'Pop quiz' });
    const quizId = quizRes.body.data.id;
    const questionRes = await request(app)
      .post(`/api/v1/courses/${course.id}/quizzes/${quizId}/questions`)
      .set('Cookie', teacherCookies)
      .send({ type: 'mcq', prompt: '1+1?', options: ['1', '2'], correctIndex: 1, points: 1, orderIndex: 0 });
    const questionId = questionRes.body.data.id;
    await request(app)
      .patch(`/api/v1/courses/${course.id}/quizzes/${quizId}/publish`)
      .set('Cookie', teacherCookies)
      .send({ status: 'published' });

    // Only student1 attempts, correctly.
    await request(app)
      .post(`/api/v1/courses/${course.id}/quizzes/${quizId}/attempts`)
      .set('Cookie', student1Cookies)
      .send({ responses: [{ questionId, answer: 1 }] });

    // Teacher view: full matrix.
    const gradebookRes = await request(app)
      .get(`/api/v1/courses/${course.id}/gradebook`)
      .set('Cookie', teacherCookies);
    expect(gradebookRes.status).toBe(200);
    expect(gradebookRes.body.data.assessments).toEqual(
      expect.arrayContaining([
        { id: assignmentId, type: 'assignment', title: 'Essay', maxScore: 10 },
        { id: quizId, type: 'quiz', title: 'Pop quiz', maxScore: 1 },
      ]),
    );
    expect(gradebookRes.body.data.rows).toHaveLength(3);

    const row1 = gradebookRes.body.data.rows.find((r: { studentId: string }) => r.studentId === student1.id);
    expect(row1.average).toBeCloseTo((8 + 1) / (10 + 1) * 100);
    expect(row1.entries).toEqual(
      expect.arrayContaining([
        { assessmentId: assignmentId, type: 'assignment', score: 8, maxScore: 10, status: 'graded' },
        { assessmentId: quizId, type: 'quiz', score: 1, maxScore: 1, status: 'graded' },
      ]),
    );

    const row2 = gradebookRes.body.data.rows.find((r: { studentId: string }) => r.studentId === student2.id);
    expect(row2.entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ assessmentId: assignmentId, status: 'pending', score: null }),
        expect.objectContaining({ assessmentId: quizId, status: 'not_attempted' }),
      ]),
    );

    const row3 = gradebookRes.body.data.rows.find((r: { studentId: string }) => r.studentId === student3.id);
    expect(row3.average).toBeNull();
    expect(row3.entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ assessmentId: assignmentId, status: 'not_submitted' }),
        expect.objectContaining({ assessmentId: quizId, status: 'not_attempted' }),
      ]),
    );

    // Student self-view matches their own row.
    const myRes = await request(app)
      .get(`/api/v1/courses/${course.id}/gradebook/me`)
      .set('Cookie', student1Cookies);
    expect(myRes.status).toBe(200);
    expect(myRes.body.data.studentId).toBe(student1.id);
    expect(myRes.body.data.average).toBeCloseTo(row1.average);

    // Access control.
    const asStudent = await request(app)
      .get(`/api/v1/courses/${course.id}/gradebook`)
      .set('Cookie', student1Cookies);
    expect(asStudent.status).toBe(403);
  });
});
