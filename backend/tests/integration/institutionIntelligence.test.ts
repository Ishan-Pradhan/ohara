import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import request from 'supertest';

vi.mock('../../src/services/email.service.js', async () => {
  const { emailServiceStub } = await import('../helpers/auth.js');
  return emailServiceStub();
});

vi.mock('../../src/services/llm.service.js', () => ({
  generateJson: vi.fn(),
  generateText: vi.fn(),
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
  createProgram,
  createClass,
} = await import('../helpers/institution.js');
const { courseTeacherRepository } = await import(
  '../../src/repositories/courseTeachers.repository.js'
);
const { generateText, generateJson } = await import('../../src/services/llm.service.js');

const PASSWORD = 'hunter2secret';

const signInAs = async (email: string, role: string): Promise<string[]> => {
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
  vi.mocked(generateText).mockReset();
  vi.mocked(generateJson).mockReset();
});

afterAll(async () => {
  await closeDb();
});

describe('Institution Intelligence (Group 3)', () => {
  // ── Institution Performance ─────────────────────────────────────────

  describe('GET /admin/institution-performance', () => {
    it('returns aggregate institution metrics for admin', async () => {
      const program = await createProgram({ name: 'Engineering' });
      const cls = await createClass({ programId: program.id, name: 'Year 1' });
      const course = await createCourse({ classId: cls.id, title: 'Physics' });
      const teacher = await createTeacherUser({ email: `teacher-perf-${Date.now()}@example.com` });
      await courseTeacherRepository.assign({ teacherId: teacher.id, courseId: course.id });
      const student = await createStudentUser({ email: `student-perf-${Date.now()}@example.com` });
      await createEnrollment({ studentId: student.id, courseId: course.id });

      const adminCookies = await signInAs(`admin-perf-${Date.now()}@example.com`, 'admin');

      vi.mocked(generateJson).mockResolvedValue({
        summary: 'Institution is performing well.',
        highlights: ['Good enrollment'],
        concerns: [],
        recommendations: ['Continue current approach'],
      });

      const res = await request(app)
        .get('/api/v1/admin/institution-performance')
        .set('Cookie', adminCookies);

      expect(res.status).toBe(200);
      expect(res.body.data).toMatchObject({
        totals: {
          programs: expect.any(Number),
          courses: expect.any(Number),
          students: expect.any(Number),
          teachers: expect.any(Number),
        },
        academic: {
          overallAverageGrade: expect.anything(),
          overallAttendanceRate: expect.anything(),
          totalAtRisk: expect.any(Number),
          totalMissingSubmissions: expect.any(Number),
        },
      });
      expect(Array.isArray(res.body.data.programs)).toBe(true);
      expect(Array.isArray(res.body.data.topCourses)).toBe(true);
      expect(Array.isArray(res.body.data.bottomCourses)).toBe(true);
    });

    it('rejects non-admin users', async () => {
      const teacher = await createTeacherUser({ email: `teacher-perf-reject-${Date.now()}@example.com` });
      const teacherCookies = await signInAs(teacher.email, 'teacher');

      const res = await request(app)
        .get('/api/v1/admin/institution-performance')
        .set('Cookie', teacherCookies);

      expect(res.status).toBe(403);
    });
  });

  // ── Admin Copilot ───────────────────────────────────────────────────

  describe('POST /admin/copilot/query', () => {
    it('returns AI-generated response for admin query', async () => {
      const adminCookies = await signInAs(`admin-copilot-${Date.now()}@example.com`, 'admin');

      vi.mocked(generateText).mockResolvedValue('The institution has 5 courses.');

      const res = await request(app)
        .post('/api/v1/admin/copilot/query')
        .set('Cookie', adminCookies)
        .send({ question: 'How many courses do we have?' });

      expect(res.status).toBe(200);
      expect(res.body.data).toMatchObject({
        answer: expect.any(String),
      });
      expect(vi.mocked(generateText)).toHaveBeenCalledTimes(1);
    });

    it('rejects non-admin users', async () => {
      const teacher = await createTeacherUser({ email: `teacher-copilot-reject-${Date.now()}@example.com` });
      const teacherCookies = await signInAs(teacher.email, 'teacher');

      const res = await request(app)
        .post('/api/v1/admin/copilot/query')
        .set('Cookie', teacherCookies)
        .send({ question: 'Hello?' });

      expect(res.status).toBe(403);
    });

    it('rejects empty query', async () => {
      const adminCookies = await signInAs(`admin-copilot-empty-${Date.now()}@example.com`, 'admin');

      const res = await request(app)
        .post('/api/v1/admin/copilot/query')
        .set('Cookie', adminCookies)
        .send({ question: '' });

      expect(res.status).toBe(400);
    });
  });

  // ── Institution Weekly Intelligence ─────────────────────────────────

  describe('GET /admin/weekly-intelligence', () => {
    it('returns weekly intelligence data for admin', async () => {
      const adminCookies = await signInAs(`admin-weekly-${Date.now()}@example.com`, 'admin');

      vi.mocked(generateJson).mockResolvedValue({
        summary: 'Week was productive.',
        highlights: ['High attendance'],
        concerns: [],
        recommendations: ['Keep it up'],
      });

      const res = await request(app)
        .get('/api/v1/admin/weekly-intelligence')
        .set('Cookie', adminCookies);

      expect(res.status).toBe(200);
      expect(res.body.data).toMatchObject({
        week: expect.any(String),
        attendance: {
          sessionsThisWeek: expect.any(Number),
          present: expect.any(Number),
          absent: expect.any(Number),
          late: expect.any(Number),
        },
        submissions: {
          dueThisWeek: expect.any(Number),
          submitted: expect.any(Number),
          late: expect.any(Number),
          missing: expect.any(Number),
        },
        quizzes: {
          availableThisWeek: expect.any(Number),
          attempts: expect.any(Number),
        },
      });
      // rate and averageScore are null when no data exists
      expect(typeof res.body.data.attendance.rate === 'number' || res.body.data.attendance.rate === null).toBe(true);
      expect(typeof res.body.data.quizzes.averageScore === 'number' || res.body.data.quizzes.averageScore === null).toBe(true);
      expect(Array.isArray(res.body.data.programSummaries)).toBe(true);
    });

    it('rejects non-admin users', async () => {
      const teacher = await createTeacherUser({ email: `teacher-weekly-reject-${Date.now()}@example.com` });
      const teacherCookies = await signInAs(teacher.email, 'teacher');

      const res = await request(app)
        .get('/api/v1/admin/weekly-intelligence')
        .set('Cookie', teacherCookies);

      expect(res.status).toBe(403);
    });
  });
});
