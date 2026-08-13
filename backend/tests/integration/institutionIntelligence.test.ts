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

  describe('Admin Copilot', () => {
    it('creates a conversation, sends a message, lists conversations, and persists history', async () => {
      const adminCookies = await signInAs(`admin-copilot-${Date.now()}@example.com`, 'admin');

      const createConv = await request(app)
        .post('/api/v1/admin/copilot/conversations')
        .set('Cookie', adminCookies);

      expect(createConv.status).toBe(201);
      const convId = createConv.body.data.id;
      expect(createConv.body.data.title).toBe('New conversation');

      vi.mocked(generateText).mockResolvedValueOnce('The institution has 5 courses.');

      const sendMsg = await request(app)
        .post(`/api/v1/admin/copilot/conversations/${convId}/messages`)
        .set('Cookie', adminCookies)
        .send({ message: 'How many courses do we have?' });

      expect(sendMsg.status).toBe(200);
      expect(sendMsg.body.data.userMessage).toBeDefined();
      expect(sendMsg.body.data.assistantMessage.content).toContain('5 courses');
      expect(generateText).toHaveBeenCalledTimes(1);

      const getConv = await request(app)
        .get(`/api/v1/admin/copilot/conversations/${convId}`)
        .set('Cookie', adminCookies);

      expect(getConv.status).toBe(200);
      expect(getConv.body.data.messages).toHaveLength(2);
      expect(getConv.body.data.title).toBe('How many courses do we have?');

      const listConvs = await request(app)
        .get('/api/v1/admin/copilot/conversations')
        .set('Cookie', adminCookies);

      expect(listConvs.status).toBe(200);
      expect(listConvs.body.data).toHaveLength(1);
    });

    it('includes recent conversation history in the prompt for a follow-up message', async () => {
      const adminCookies = await signInAs(`admin-copilot-history-${Date.now()}@example.com`, 'admin');

      const createConv = await request(app)
        .post('/api/v1/admin/copilot/conversations')
        .set('Cookie', adminCookies);
      const convId = createConv.body.data.id;

      vi.mocked(generateText).mockResolvedValueOnce('The Science program has the highest average.');
      await request(app)
        .post(`/api/v1/admin/copilot/conversations/${convId}/messages`)
        .set('Cookie', adminCookies)
        .send({ message: 'Which program performs best?' });

      vi.mocked(generateText).mockResolvedValueOnce('Yes, it beats every other program by 8 points.');
      const followUp = await request(app)
        .post(`/api/v1/admin/copilot/conversations/${convId}/messages`)
        .set('Cookie', adminCookies)
        .send({ message: 'Do they beat the others by a lot?' });

      expect(followUp.status).toBe(200);
      expect(generateText).toHaveBeenCalledTimes(2);
      const secondCallPrompt = vi.mocked(generateText).mock.calls[1]?.[1] as string;
      expect(secondCallPrompt).toContain('Which program performs best?');
      expect(secondCallPrompt).toContain('The Science program has the highest average.');
      expect(secondCallPrompt).toContain('Do they beat the others by a lot?');
    });

    it('rejects non-admin users', async () => {
      const teacher = await createTeacherUser({ email: `teacher-copilot-reject-${Date.now()}@example.com` });
      const teacherCookies = await signInAs(teacher.email, 'teacher');

      const res = await request(app)
        .post('/api/v1/admin/copilot/conversations')
        .set('Cookie', teacherCookies);

      expect(res.status).toBe(403);
    });

    it('rejects an empty message', async () => {
      const adminCookies = await signInAs(`admin-copilot-empty-${Date.now()}@example.com`, 'admin');

      const createConv = await request(app)
        .post('/api/v1/admin/copilot/conversations')
        .set('Cookie', adminCookies);
      const convId = createConv.body.data.id;

      const res = await request(app)
        .post(`/api/v1/admin/copilot/conversations/${convId}/messages`)
        .set('Cookie', adminCookies)
        .send({ message: '' });

      expect(res.status).toBe(400);
    });

    it('deletes a conversation, and one admin cannot access another admin\'s conversation', async () => {
      const adminCookies = await signInAs(`admin-copilot-owner-${Date.now()}@example.com`, 'admin');
      const otherAdminCookies = await signInAs(`admin-copilot-other-${Date.now()}@example.com`, 'admin');

      const createConv = await request(app)
        .post('/api/v1/admin/copilot/conversations')
        .set('Cookie', adminCookies);
      const convId = createConv.body.data.id;

      const otherAccess = await request(app)
        .get(`/api/v1/admin/copilot/conversations/${convId}`)
        .set('Cookie', otherAdminCookies);
      expect(otherAccess.status).toBe(403);

      const del = await request(app)
        .delete(`/api/v1/admin/copilot/conversations/${convId}`)
        .set('Cookie', adminCookies);
      expect(del.status).toBe(200);

      const getAfterDelete = await request(app)
        .get(`/api/v1/admin/copilot/conversations/${convId}`)
        .set('Cookie', adminCookies);
      expect(getAfterDelete.status).toBe(404);
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
