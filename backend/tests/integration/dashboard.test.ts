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
  createProgram,
  createClass,
  createSection,
  createAcademicYear,
  createCourse,
  createStudentUser,
  createTeacherUser,
  createBatch,
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

/** Places `studentId` into `sectionId` (under `batchId`) for the current year and enrolls in
 * `courseId` — same helper shape as students.test.ts. */
const placeAndEnroll = async (
  adminCookies: string[],
  studentId: string,
  sectionId: string,
  courseId: string,
  batchId: string,
) => {
  await request(app)
    .post('/api/v1/admin/class-memberships')
    .set('Cookie', adminCookies)
    .send({ studentId, sectionId, batchId });
  await request(app)
    .post('/api/v1/admin/enrollments')
    .set('Cookie', adminCookies)
    .send({ studentId, courseId });
};

const RUBRIC = [{ criterion: 'Quality', maxPoints: 10, description: 'Overall quality' }];

beforeEach(async () => {
  await truncateAll();
  vi.mocked(generateJson).mockReset();
});

afterAll(async () => {
  await closeDb();
});

describe('GET /dashboard/me', () => {
  it('reports not-placed for a student with no class membership', async () => {
    const studentCookies = await signInAs('unplaced@example.com', 'student');
    const res = await request(app).get('/api/v1/dashboard/me').set('Cookie', studentCookies);
    expect(res.status).toBe(200);
    expect(res.body.data.placed).toBe(false);
    expect(res.body.data.courses).toEqual([]);
  });

  it('rejects a non-student caller with 403', async () => {
    const teacherCookies = await signInAs('teacher-only@example.com', 'teacher');
    const res = await request(app).get('/api/v1/dashboard/me').set('Cookie', teacherCookies);
    expect(res.status).toBe(403);
  });

  it('lists undone assignments/quizzes as upcoming and moves them to recentGrades once graded', async () => {
    const adminCookies = await signInAs('admin@example.com', 'admin');
    const program = await createProgram({ institutionType: 'college' });
    const cls = await createClass({ programId: program.id });
    const year = await createAcademicYear({ isCurrent: true });
    const section = await createSection({ classId: cls.id, academicYearId: year.id });
    const course = await createCourse({ classId: cls.id, title: 'Physics' });
    const batch = await createBatch({ programId: program.id });
    const student = await createStudentUser({ email: `student-${Date.now()}@example.com` });
    const teacher = await createTeacherUser({ email: `teacher-${Date.now()}@example.com` });
    await courseTeacherRepository.assign({ teacherId: teacher.id, courseId: course.id });

    await placeAndEnroll(adminCookies, student.id, section.id, course.id, batch.id);

    const studentCookies = await signInAs(student.email, 'student');
    const teacherCookies = await signInAs(teacher.email, 'teacher');

    const assignmentRes = await request(app)
      .post(`/api/v1/courses/${course.id}/assignments`)
      .set('Cookie', teacherCookies)
      .send({
        title: 'Essay 1',
        prompt: 'Explain photosynthesis.',
        rubric: RUBRIC,
        dueAt: new Date(Date.now() + 3600_000).toISOString(),
      });
    const assignmentId = assignmentRes.body.data.id;

    const quizRes = await request(app)
      .post(`/api/v1/courses/${course.id}/quizzes`)
      .set('Cookie', teacherCookies)
      .send({ title: 'Quiz 1' });
    const quizId = quizRes.body.data.id;
    const questionRes = await request(app)
      .post(`/api/v1/courses/${course.id}/quizzes/${quizId}/questions`)
      .set('Cookie', teacherCookies)
      .send({
        type: 'mcq',
        prompt: '2+2?',
        options: ['3', '4'],
        correctIndex: 1,
        points: 1,
        orderIndex: 0,
      });
    const questionId = questionRes.body.data.id;
    await request(app)
      .patch(`/api/v1/courses/${course.id}/quizzes/${quizId}/publish`)
      .set('Cookie', teacherCookies)
      .send({ status: 'published' });

    let dashboard = (
      await request(app).get('/api/v1/dashboard/me').set('Cookie', studentCookies)
    ).body.data;
    expect(dashboard.placed).toBe(true);
    expect(dashboard.courses).toEqual([{ id: course.id, title: 'Physics', code: course.code }]);
    expect(dashboard.upcoming).toHaveLength(2);
    expect(dashboard.upcoming.map((u: { type: string }) => u.type).sort()).toEqual([
      'assignment',
      'quiz',
    ]);
    expect(dashboard.recentGrades).toHaveLength(0);
    expect(dashboard.unreadNotificationCount).toBe(2); // assignment_created + quiz_published

    // Complete the quiz — it should drop out of upcoming and into recentGrades.
    await request(app)
      .post(`/api/v1/courses/${course.id}/quizzes/${quizId}/attempts`)
      .set('Cookie', studentCookies)
      .send({ responses: [{ questionId, answer: 1 }] });

    // Submit + AI-grade + approve the assignment — same transition.
    await request(app)
      .post(`/api/v1/courses/${course.id}/assignments/${assignmentId}/submissions`)
      .set('Cookie', studentCookies)
      .send({ content: 'Photosynthesis converts light into chemical energy.' });
    const submissionsRes = await request(app)
      .get(`/api/v1/courses/${course.id}/assignments/${assignmentId}/submissions`)
      .set('Cookie', teacherCookies);
    const submissionId = submissionsRes.body.data[0].id;
    vi.mocked(generateJson).mockResolvedValueOnce(
      JSON.stringify({
        criterionFeedback: [{ criterion: 'Quality', awardedPoints: 8, feedback: 'Good.' }],
        overallFeedback: 'Good.',
      }),
    );
    await request(app)
      .post(`/api/v1/courses/${course.id}/assignments/${assignmentId}/submissions/${submissionId}/grade`)
      .set('Cookie', teacherCookies);
    await request(app)
      .patch(`/api/v1/courses/${course.id}/assignments/${assignmentId}/submissions/${submissionId}/grade`)
      .set('Cookie', teacherCookies)
      .send({
        criterionFeedback: [{ criterion: 'Quality', maxPoints: 10, awardedPoints: 8, feedback: 'Good.' }],
        status: 'approved',
      });

    dashboard = (await request(app).get('/api/v1/dashboard/me').set('Cookie', studentCookies)).body
      .data;
    expect(dashboard.upcoming).toHaveLength(0);
    expect(dashboard.recentGrades).toHaveLength(2);
    const quizGrade = dashboard.recentGrades.find((g: { type: string }) => g.type === 'quiz');
    expect(quizGrade.score).toBe(1);
    expect(quizGrade.maxScore).toBe(1);
    const assignmentGrade = dashboard.recentGrades.find(
      (g: { type: string }) => g.type === 'assignment',
    );
    expect(assignmentGrade.score).toBe(8);
    expect(assignmentGrade.maxScore).toBe(10);
    expect(dashboard.unreadNotificationCount).toBe(3); // + assignment_graded
  });
});
