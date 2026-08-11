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
} = await import('../helpers/institution.js');
const { courseTeacherRepository } = await import(
  '../../src/repositories/courseTeachers.repository.js'
);
const { generateText, generateJson } = await import('../../src/services/llm.service.js');

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
  vi.mocked(generateText).mockReset();
  vi.mocked(generateJson).mockReset();
});

afterAll(async () => {
  await closeDb();
});

describe('Teacher Intelligence', () => {
  // ── Class Intelligence ──────────────────────────────────────────────

  describe('GET /courses/:courseId/class-intelligence', () => {
    it('returns deterministic class summary for a teacher', async () => {
      const course = await createCourse();
      const teacher = await createTeacherUser({ email: `teacher-${Date.now()}@example.com` });
      await courseTeacherRepository.assign({ teacherId: teacher.id, courseId: course.id });
      const student = await createStudentUser({ email: `student-${Date.now()}@example.com` });
      await createEnrollment({ studentId: student.id, courseId: course.id });

      const teacherCookies = await signInAs(teacher.email, 'teacher');

      const res = await request(app)
        .get(`/api/v1/courses/${course.id}/class-intelligence`)
        .set('Cookie', teacherCookies);

      expect(res.status).toBe(200);
      expect(res.body.data).toMatchObject({
        courseId: course.id,
        enrollmentCount: 1,
        activeStudents: 1,
      });
      expect(typeof res.body.data.classAverage === 'number' || res.body.data.classAverage === null).toBe(true);
      expect(Array.isArray(res.body.data.topPerformers)).toBe(true);
      expect(Array.isArray(res.body.data.bottomPerformers)).toBe(true);
    });

    it('returns 403 for a non-teacher', async () => {
      const course = await createCourse();
      const student = await createStudentUser({ email: `student-${Date.now()}@example.com` });
      await createEnrollment({ studentId: student.id, courseId: course.id });
      const studentCookies = await signInAs(student.email, 'student');

      const res = await request(app)
        .get(`/api/v1/courses/${course.id}/class-intelligence`)
        .set('Cookie', studentCookies);

      expect(res.status).toBe(403);
    });
  });

  // ── Intervention CRUD ───────────────────────────────────────────────

  describe('Interventions', () => {
    it('creates, lists, resolves, and deletes an intervention', async () => {
      const course = await createCourse();
      const teacher = await createTeacherUser({ email: `teacher-${Date.now()}@example.com` });
      await courseTeacherRepository.assign({ teacherId: teacher.id, courseId: course.id });
      const student = await createStudentUser({ email: `student-${Date.now()}@example.com` });
      await createEnrollment({ studentId: student.id, courseId: course.id });

      const teacherCookies = await signInAs(teacher.email, 'teacher');

      // Create
      const createRes = await request(app)
        .post(`/api/v1/courses/${course.id}/interventions`)
        .set('Cookie', teacherCookies)
        .send({
          studentId: student.id,
          type: 'meeting',
          title: 'Parent meeting scheduled',
          notes: 'Met with parent to discuss attendance',
          actions: [{ description: 'Follow up in 2 weeks', timeline: '2 weeks' }],
        });

      expect(createRes.status).toBe(201);
      const interventionId = createRes.body.data.id;
      expect(createRes.body.data.type).toBe('meeting');
      expect(createRes.body.data.status).toBe('active');

      // List
      const listRes = await request(app)
        .get(`/api/v1/courses/${course.id}/interventions`)
        .set('Cookie', teacherCookies);

      expect(listRes.status).toBe(200);
      expect(listRes.body.data).toHaveLength(1);
      expect(listRes.body.data[0].id).toBe(interventionId);

      // Get single
      const getRes = await request(app)
        .get(`/api/v1/courses/${course.id}/interventions/${interventionId}`)
        .set('Cookie', teacherCookies);

      expect(getRes.status).toBe(200);
      expect(getRes.body.data.id).toBe(interventionId);

      // Resolve
      const resolveRes = await request(app)
        .patch(`/api/v1/courses/${course.id}/interventions/${interventionId}/resolve`)
        .set('Cookie', teacherCookies);

      expect(resolveRes.status).toBe(200);
      expect(resolveRes.body.data.status).toBe('resolved');
      expect(resolveRes.body.data.resolvedAt).not.toBeNull();

      // Delete
      const deleteRes = await request(app)
        .delete(`/api/v1/courses/${course.id}/interventions/${interventionId}`)
        .set('Cookie', teacherCookies);

      expect(deleteRes.status).toBe(200);

      // Verify deleted
      const listAfterDelete = await request(app)
        .get(`/api/v1/courses/${course.id}/interventions`)
        .set('Cookie', teacherCookies);

      expect(listAfterDelete.body.data).toHaveLength(0);
    });

    it('returns 403 for a non-teacher creating interventions', async () => {
      const course = await createCourse();
      const student = await createStudentUser({ email: `student-${Date.now()}@example.com` });
      await createEnrollment({ studentId: student.id, courseId: course.id });
      const studentCookies = await signInAs(student.email, 'student');

      const res = await request(app)
        .post(`/api/v1/courses/${course.id}/interventions`)
        .set('Cookie', studentCookies)
        .send({
          studentId: student.id,
          type: 'manual',
          title: 'Test',
          notes: 'Test notes',
        });

      expect(res.status).toBe(403);
    });

    it('filters interventions by studentId', async () => {
      const course = await createCourse();
      const teacher = await createTeacherUser({ email: `teacher-${Date.now()}@example.com` });
      await courseTeacherRepository.assign({ teacherId: teacher.id, courseId: course.id });
      const student1 = await createStudentUser({ email: `s1-${Date.now()}@example.com` });
      const student2 = await createStudentUser({ email: `s2-${Date.now()}@example.com` });
      await createEnrollment({ studentId: student1.id, courseId: course.id });
      await createEnrollment({ studentId: student2.id, courseId: course.id });

      const teacherCookies = await signInAs(teacher.email, 'teacher');

      // Create interventions for both students
      await request(app)
        .post(`/api/v1/courses/${course.id}/interventions`)
        .set('Cookie', teacherCookies)
        .send({ studentId: student1.id, type: 'manual', title: 'For S1', notes: 'Notes' });

      await request(app)
        .post(`/api/v1/courses/${course.id}/interventions`)
        .set('Cookie', teacherCookies)
        .send({ studentId: student2.id, type: 'meeting', title: 'For S2', notes: 'Notes' });

      // Filter by student1
      const filtered = await request(app)
        .get(`/api/v1/courses/${course.id}/interventions?studentId=${student1.id}`)
        .set('Cookie', teacherCookies);

      expect(filtered.status).toBe(200);
      expect(filtered.body.data).toHaveLength(1);
      expect(filtered.body.data[0].studentId).toBe(student1.id);
    });
  });

  // ── AI Intervention Generator ───────────────────────────────────────

  describe('POST /courses/:courseId/interventions/generate/:studentId', () => {
    it('generates and persists an AI intervention plan', async () => {
      const course = await createCourse();
      const teacher = await createTeacherUser({ email: `teacher-${Date.now()}@example.com` });
      await courseTeacherRepository.assign({ teacherId: teacher.id, courseId: course.id });
      const student = await createStudentUser({ email: `student-${Date.now()}@example.com` });
      await createEnrollment({ studentId: student.id, courseId: course.id });

      const teacherCookies = await signInAs(teacher.email, 'teacher');

      vi.mocked(generateJson).mockResolvedValueOnce(
        JSON.stringify({
          title: 'Attendance Improvement Plan',
          summary: 'Student has low attendance and missing assignments.',
          actions: [
            { description: 'Schedule a meeting', timeline: 'Within 3 days' },
            { description: 'Create a make-up work schedule', timeline: 'Within 1 week' },
          ],
          priority: 'high',
        }),
      );

      const res = await request(app)
        .post(`/api/v1/courses/${course.id}/interventions/generate/${student.id}`)
        .set('Cookie', teacherCookies);

      expect(res.status).toBe(200);
      expect(res.body.data.type).toBe('ai_generated');
      expect(res.body.data.title).toBe('Attendance Improvement Plan');
      expect(res.body.data.actions).toHaveLength(2);
      expect(res.body.data.status).toBe('active');
      expect(generateJson).toHaveBeenCalledTimes(1);
    });

    it('returns 404 for a non-enrolled student', async () => {
      const course = await createCourse();
      const teacher = await createTeacherUser({ email: `teacher-${Date.now()}@example.com` });
      await courseTeacherRepository.assign({ teacherId: teacher.id, courseId: course.id });
      const outsider = await createStudentUser({ email: `outsider-${Date.now()}@example.com` });

      const teacherCookies = await signInAs(teacher.email, 'teacher');

      const res = await request(app)
        .post(`/api/v1/courses/${course.id}/interventions/generate/${outsider.id}`)
        .set('Cookie', teacherCookies);

      expect(res.status).toBe(404);
    });
  });

  // ── AI Lesson Planner ───────────────────────────────────────────────

  describe('POST /courses/:courseId/lesson-plan', () => {
    it('generates a structured lesson plan', async () => {
      const course = await createCourse();
      const teacher = await createTeacherUser({ email: `teacher-${Date.now()}@example.com` });
      await courseTeacherRepository.assign({ teacherId: teacher.id, courseId: course.id });

      const teacherCookies = await signInAs(teacher.email, 'teacher');

      vi.mocked(generateJson).mockResolvedValueOnce(
        JSON.stringify({
          title: 'Introduction to Algebra',
          objectives: ['Understand variables', 'Solve simple equations'],
          outline: [
            { section: 'Warm-up', durationMinutes: 5, description: 'Review arithmetic' },
            { section: 'Main lesson', durationMinutes: 30, description: 'Teach variables' },
            { section: 'Practice', durationMinutes: 10, description: 'Worksheet' },
          ],
          activities: [
            { name: 'Think-pair-share', type: 'discussion', description: 'Discuss real-world variables', durationMinutes: 10 },
            { name: 'Guided practice', type: 'practice', description: 'Solve equations together', durationMinutes: 15 },
          ],
          assessmentIdeas: ['Exit ticket with 3 equations'],
          materials: ['Whiteboard', 'Worksheets'],
        }),
      );

      const res = await request(app)
        .post(`/api/v1/courses/${course.id}/lesson-plan`)
        .set('Cookie', teacherCookies)
        .send({ topic: 'Introduction to Algebra', durationMinutes: 45 });

      expect(res.status).toBe(200);
      expect(res.body.data.title).toBe('Introduction to Algebra');
      expect(res.body.data.objectives).toHaveLength(2);
      expect(res.body.data.outline).toHaveLength(3);
      expect(res.body.data.activities).toHaveLength(2);
      expect(res.body.data.assessmentIdeas).toHaveLength(1);
      expect(generateJson).toHaveBeenCalledTimes(1);
    });
  });

  // ── Teacher Copilot ─────────────────────────────────────────────────

  describe('Teacher Copilot', () => {
    it('creates a conversation, sends a message, and lists conversations', async () => {
      const course = await createCourse();
      const teacher = await createTeacherUser({ email: `teacher-${Date.now()}@example.com` });
      await courseTeacherRepository.assign({ teacherId: teacher.id, courseId: course.id });
      const student = await createStudentUser({ email: `student-${Date.now()}@example.com` });
      await createEnrollment({ studentId: student.id, courseId: course.id });

      const teacherCookies = await signInAs(teacher.email, 'teacher');

      // Create conversation
      const createConv = await request(app)
        .post(`/api/v1/courses/${course.id}/copilot/conversations`)
        .set('Cookie', teacherCookies);

      expect(createConv.status).toBe(201);
      const convId = createConv.body.data.id;
      expect(createConv.body.data.title).toBe('New conversation');

      // Send a message
      vi.mocked(generateText).mockResolvedValueOnce(
        'The class average is 75% and 1 student is at risk.',
      );

      const sendMsg = await request(app)
        .post(`/api/v1/courses/${course.id}/copilot/conversations/${convId}/messages`)
        .set('Cookie', teacherCookies)
        .send({ message: 'How is the class doing?' });

      expect(sendMsg.status).toBe(200);
      expect(sendMsg.body.data.userMessage).toBeDefined();
      expect(sendMsg.body.data.assistantMessage).toBeDefined();
      expect(sendMsg.body.data.assistantMessage.content).toContain('class average');
      expect(generateText).toHaveBeenCalledTimes(1);

      // Title should update from first message
      const getConv = await request(app)
        .get(`/api/v1/courses/${course.id}/copilot/conversations/${convId}`)
        .set('Cookie', teacherCookies);

      expect(getConv.status).toBe(200);
      expect(getConv.body.data.messages).toHaveLength(2);

      // List conversations
      const listConvs = await request(app)
        .get(`/api/v1/courses/${course.id}/copilot/conversations`)
        .set('Cookie', teacherCookies);

      expect(listConvs.status).toBe(200);
      expect(listConvs.body.data).toHaveLength(1);
    });

    it('returns 403 when a student tries to access copilot', async () => {
      const course = await createCourse();
      const student = await createStudentUser({ email: `student-${Date.now()}@example.com` });
      await createEnrollment({ studentId: student.id, courseId: course.id });
      const studentCookies = await signInAs(student.email, 'student');

      const res = await request(app)
        .post(`/api/v1/courses/${course.id}/copilot/conversations`)
        .set('Cookie', studentCookies);

      expect(res.status).toBe(403);
    });

    it('deletes a conversation', async () => {
      const course = await createCourse();
      const teacher = await createTeacherUser({ email: `teacher-${Date.now()}@example.com` });
      await courseTeacherRepository.assign({ teacherId: teacher.id, courseId: course.id });

      const teacherCookies = await signInAs(teacher.email, 'teacher');

      const createConv = await request(app)
        .post(`/api/v1/courses/${course.id}/copilot/conversations`)
        .set('Cookie', teacherCookies);

      const convId = createConv.body.data.id;

      const deleteRes = await request(app)
        .delete(`/api/v1/courses/${course.id}/copilot/conversations/${convId}`)
        .set('Cookie', teacherCookies);

      expect(deleteRes.status).toBe(200);

      const listRes = await request(app)
        .get(`/api/v1/courses/${course.id}/copilot/conversations`)
        .set('Cookie', teacherCookies);

      expect(listRes.body.data).toHaveLength(0);
    });
  });
});
