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
  createAcademicYear,
} = await import('../helpers/institution.js');
const { courseTeacherRepository } = await import(
  '../../src/repositories/courseTeachers.repository.js'
);
const { generateText } = await import('../../src/services/llm.service.js');

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
});

afterAll(async () => {
  await closeDb();
});

describe('At-Risk Analytics', () => {
  it('flags a student who missed 2+ assignments, leaves an on-time student unflagged, and explains on demand', async () => {
    await createAcademicYear({ isCurrent: true });
    const course = await createCourse();
    const teacher = await createTeacherUser({ email: `teacher-${Date.now()}@example.com` });
    await courseTeacherRepository.assign({ teacherId: teacher.id, courseId: course.id });
    const strugglingStudent = await createStudentUser({ email: `struggling-${Date.now()}@example.com` });
    const onTrackStudent = await createStudentUser({ email: `ontrack-${Date.now()}@example.com` });
    await createEnrollment({ studentId: strugglingStudent.id, courseId: course.id });
    await createEnrollment({ studentId: onTrackStudent.id, courseId: course.id });

    const teacherCookies = await signInAs(teacher.email, 'teacher');
    const strugglingCookies = await signInAs(strugglingStudent.email, 'student');
    const onTrackCookies = await signInAs(onTrackStudent.email, 'student');

    const pastDue = new Date(Date.now() - 3600_000).toISOString();
    const RUBRIC = [{ criterion: 'Quality', maxPoints: 10 }];
    const assignment1 = await request(app)
      .post(`/api/v1/courses/${course.id}/assignments`)
      .set('Cookie', teacherCookies)
      .send({ title: 'Essay 1', prompt: 'Write.', rubric: RUBRIC, dueAt: pastDue });
    const assignment2 = await request(app)
      .post(`/api/v1/courses/${course.id}/assignments`)
      .set('Cookie', teacherCookies)
      .send({ title: 'Essay 2', prompt: 'Write more.', rubric: RUBRIC, dueAt: pastDue });

    // The on-track student submits both (late, since dueAt is already past — doesn't matter for "missing").
    for (const a of [assignment1, assignment2]) {
      await request(app)
        .post(`/api/v1/courses/${course.id}/assignments/${a.body.data.id}/submissions`)
        .set('Cookie', onTrackCookies)
        .send({ content: 'Done.' });
    }
    // The struggling student submits neither.

    const dashboard = await request(app)
      .get(`/api/v1/courses/${course.id}/at-risk`)
      .set('Cookie', teacherCookies);
    expect(dashboard.status).toBe(200);
    const rows = dashboard.body.data as {
      studentId: string;
      missingSubmissions: number;
      lateSubmissions: number;
      isAtRisk: boolean;
    }[];
    const strugglingRow = rows.find((r) => r.studentId === strugglingStudent.id)!;
    const onTrackRow = rows.find((r) => r.studentId === onTrackStudent.id)!;

    expect(strugglingRow.missingSubmissions).toBe(2);
    expect(strugglingRow.isAtRisk).toBe(true);
    expect(onTrackRow.missingSubmissions).toBe(0);
    expect(onTrackRow.lateSubmissions).toBe(2); // submitted after dueAt passed
    expect(onTrackRow.isAtRisk).toBe(false);

    // Non-teacher can't view the dashboard.
    const forbidden = await request(app)
      .get(`/api/v1/courses/${course.id}/at-risk`)
      .set('Cookie', strugglingCookies);
    expect(forbidden.status).toBe(403);

    // Explain the flagged student — teacher-triggered, mocked LLM.
    vi.mocked(generateText).mockResolvedValueOnce(
      'This student was flagged because they have 2 missing assignments.',
    );
    const explainRes = await request(app)
      .post(`/api/v1/courses/${course.id}/at-risk/${strugglingStudent.id}/explain`)
      .set('Cookie', teacherCookies);
    expect(explainRes.status).toBe(200);
    expect(explainRes.body.data.explanation).toContain('missing assignments');
    expect(generateText).toHaveBeenCalledTimes(1);

    const forbiddenExplain = await request(app)
      .post(`/api/v1/courses/${course.id}/at-risk/${strugglingStudent.id}/explain`)
      .set('Cookie', strugglingCookies);
    expect(forbiddenExplain.status).toBe(403);
  });
});
