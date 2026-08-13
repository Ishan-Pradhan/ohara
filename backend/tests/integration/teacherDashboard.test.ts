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

const validInsightsJson = JSON.stringify({
  summary: 'Overall performance is steady across your courses.',
  highlights: ['Physics attendance improved this week.'],
  concerns: ['Two students are missing multiple submissions.'],
  recommendations: ['Follow up with at-risk students in Physics.'],
});

beforeEach(async () => {
  await truncateAll();
  vi.mocked(generateJson).mockReset();
});

afterAll(async () => {
  await closeDb();
});

describe('GET /teacher/dashboard', () => {
  it('rejects an unauthenticated caller with 401', async () => {
    const res = await request(app).get('/api/v1/teacher/dashboard');
    expect(res.status).toBe(401);
  });

  it('never calls the LLM and returns null insights when none have been generated yet', async () => {
    const course = await createCourse({ title: 'Physics' });
    const teacher = await createTeacherUser({ email: `t-${Date.now()}@example.com` });
    await courseTeacherRepository.assign({ teacherId: teacher.id, courseId: course.id });
    const student = await createStudentUser({ email: `s-${Date.now()}@example.com` });
    await createEnrollment({ studentId: student.id, courseId: course.id });

    const teacherCookies = await signInAs(teacher.email, 'teacher');
    const res = await request(app).get('/api/v1/teacher/dashboard').set('Cookie', teacherCookies);

    expect(res.status).toBe(200);
    expect(res.body.data.totalCourses).toBe(1);
    expect(res.body.data.totalStudents).toBe(1);
    expect(res.body.data.courses[0].courseName).toBe('Physics');
    expect(res.body.data.insights).toBeNull();
    expect(res.body.data.insightsGeneratedAt).toBeNull();
    expect(generateJson).not.toHaveBeenCalled();
  });

  it('returns the cached insights from a previous generation, still without calling the LLM', async () => {
    const teacher = await createTeacherUser({ email: `t-${Date.now()}@example.com` });
    const teacherCookies = await signInAs(teacher.email, 'teacher');

    vi.mocked(generateJson).mockResolvedValueOnce(validInsightsJson);
    await request(app)
      .post('/api/v1/teacher/dashboard/insights')
      .set('Cookie', teacherCookies);
    vi.mocked(generateJson).mockReset();

    const res = await request(app).get('/api/v1/teacher/dashboard').set('Cookie', teacherCookies);

    expect(res.status).toBe(200);
    expect(res.body.data.insights.summary).toBe(JSON.parse(validInsightsJson).summary);
    expect(res.body.data.insightsGeneratedAt).not.toBeNull();
    expect(generateJson).not.toHaveBeenCalled();
  });
});

describe('POST /teacher/dashboard/insights', () => {
  it('rejects an unauthenticated caller with 401', async () => {
    const res = await request(app).post('/api/v1/teacher/dashboard/insights');
    expect(res.status).toBe(401);
  });

  it('generates and caches fresh insights on explicit request', async () => {
    const teacher = await createTeacherUser({ email: `t-${Date.now()}@example.com` });
    const teacherCookies = await signInAs(teacher.email, 'teacher');

    vi.mocked(generateJson).mockResolvedValueOnce(validInsightsJson);
    const res = await request(app)
      .post('/api/v1/teacher/dashboard/insights')
      .set('Cookie', teacherCookies);

    expect(res.status).toBe(200);
    expect(res.body.data.insights.summary).toBe(JSON.parse(validInsightsJson).summary);
    expect(res.body.data.generatedAt).toBeTruthy();
    expect(generateJson).toHaveBeenCalledTimes(1);

    // Persisted — a subsequent GET reflects it without calling the LLM again.
    const getRes = await request(app).get('/api/v1/teacher/dashboard').set('Cookie', teacherCookies);
    expect(getRes.body.data.insights.summary).toBe(JSON.parse(validInsightsJson).summary);
  });

  it('regenerating replaces the previously cached insights, not duplicates them', async () => {
    const teacher = await createTeacherUser({ email: `t-${Date.now()}@example.com` });
    const teacherCookies = await signInAs(teacher.email, 'teacher');

    vi.mocked(generateJson).mockResolvedValueOnce(validInsightsJson);
    await request(app).post('/api/v1/teacher/dashboard/insights').set('Cookie', teacherCookies);

    const secondJson = JSON.stringify({
      summary: 'Updated summary after regeneration.',
      highlights: [],
      concerns: [],
      recommendations: [],
    });
    vi.mocked(generateJson).mockResolvedValueOnce(secondJson);
    const res = await request(app)
      .post('/api/v1/teacher/dashboard/insights')
      .set('Cookie', teacherCookies);

    expect(res.status).toBe(200);
    expect(res.body.data.insights.summary).toBe('Updated summary after regeneration.');

    const { teacherDashboardInsightRepository } = await import(
      '../../src/repositories/teacherDashboardInsight.repository.js'
    );
    const cached = await teacherDashboardInsightRepository.findByTeacher(teacher.id);
    expect(cached?.content.summary).toBe('Updated summary after regeneration.');
  });

  it('retries once on invalid LLM output, then returns 502 if it fails again', async () => {
    const teacher = await createTeacherUser({ email: `t-${Date.now()}@example.com` });
    const teacherCookies = await signInAs(teacher.email, 'teacher');

    vi.mocked(generateJson)
      .mockResolvedValueOnce('not valid json')
      .mockResolvedValueOnce('still not valid json');

    const res = await request(app)
      .post('/api/v1/teacher/dashboard/insights')
      .set('Cookie', teacherCookies);

    expect(res.status).toBe(502);
    expect(generateJson).toHaveBeenCalledTimes(2);
  });

  it('rejects a non-teacher with 403', async () => {
    const studentCookies = await signInAs(`s-${Date.now()}@example.com`, 'student');
    const res = await request(app)
      .post('/api/v1/teacher/dashboard/insights')
      .set('Cookie', studentCookies);
    expect(res.status).toBe(403);
  });
});
