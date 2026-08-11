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

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────

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

/**
 * Build a minimal but Zod-valid StudyPlanContent that the LLM mock returns.
 * weekStart is the Monday of the current week (matches what the controller computes).
 */
const buildValidPlanContent = (weekStart: string) => {
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const;
  return {
    summary: 'Focus on reviewing weak concepts and completing pending assignments.',
    weekStart,
    days: days.map((day, i) => {
      const date = new Date(weekStart + 'T00:00:00');
      date.setDate(date.getDate() + i);
      return {
        day,
        date: date.toISOString().split('T')[0],
        tasks:
          day === 'Monday'
            ? [
                {
                  type: 'review' as const,
                  title: 'Review Chapter 1',
                  courseTitle: 'Physics',
                  description: 'Go over the key concepts from Chapter 1.',
                  estimatedMinutes: 45,
                  priority: 'high' as const,
                },
              ]
            : [],
      };
    }),
    evidence: {
      upcomingAssessments: 0,
      weakConcepts: 0,
      missingSubmissions: 0,
      averageGrade: null,
    },
  };
};

/** Compute the Monday of the current week (same logic as the controller). */
const currentWeekMonday = (): string => {
  const today = new Date();
  const dayOfWeek = today.getDay(); // 0=Sunday
  const daysToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(today);
  monday.setDate(today.getDate() + daysToMonday);
  return monday.toISOString().split('T')[0]!;
};

// ──────────────────────────────────────────────────────────────────────────────
// Test lifecycle
// ──────────────────────────────────────────────────────────────────────────────

beforeEach(async () => {
  await truncateAll();
  vi.mocked(generateJson).mockReset();
});

afterAll(async () => {
  await closeDb();
});

// ──────────────────────────────────────────────────────────────────────────────
// GET /dashboard/me/study-plan
// ──────────────────────────────────────────────────────────────────────────────

describe('GET /dashboard/me/study-plan', () => {
  it('returns null when the student has no study plan yet', async () => {
    const student = await createStudentUser({ email: `s-${Date.now()}@example.com` });
    const studentCookies = await signInAs(student.email, 'student');

    const res = await request(app)
      .get('/api/v1/dashboard/me/study-plan')
      .set('Cookie', studentCookies);

    expect(res.status).toBe(200);
    expect(res.body.data).toBeNull();
  });

  it('returns the active study plan after one has been generated', async () => {
    const adminCookies = await signInAs('admin@example.com', 'admin');
    const program = await createProgram({ institutionType: 'college' });
    const cls = await createClass({ programId: program.id });
    const year = await createAcademicYear({ isCurrent: true, term: 'odd' });
    const section = await createSection({ classId: cls.id, academicYearId: year.id });
    const course = await createCourse({ classId: cls.id, title: 'Physics' });
    const batch = await createBatch({ programId: program.id });
    const student = await createStudentUser({ email: `s2-${Date.now()}@example.com` });
    const teacher = await createTeacherUser({ email: `t2-${Date.now()}@example.com` });
    await courseTeacherRepository.assign({ teacherId: teacher.id, courseId: course.id });
    await placeAndEnroll(adminCookies, student.id, section.id, course.id, batch.id);

    const studentCookies = await signInAs(student.email, 'student');
    const weekStart = currentWeekMonday();
    const planContent = buildValidPlanContent(weekStart);
    vi.mocked(generateJson).mockResolvedValueOnce(JSON.stringify(planContent));

    await request(app)
      .post('/api/v1/dashboard/me/study-plan')
      .set('Cookie', studentCookies);

    const res = await request(app)
      .get('/api/v1/dashboard/me/study-plan')
      .set('Cookie', studentCookies);

    expect(res.status).toBe(200);
    expect(res.body.data).not.toBeNull();
    expect(res.body.data.status).toBe('active');
    expect(res.body.data.weekStart).toBe(weekStart);
    expect(res.body.data.content.summary).toBe(planContent.summary);
    expect(res.body.data.content.days).toHaveLength(7);
    expect(res.body.data.content.days[0].day).toBe('Monday');
    expect(res.body.data.content.days[0].tasks).toHaveLength(1);
    expect(res.body.data.content.days[0].tasks[0].title).toBe('Review Chapter 1');
  });

  it('returns 401 for unauthenticated requests', async () => {
    const res = await request(app).get('/api/v1/dashboard/me/study-plan');
    expect(res.status).toBe(401);
  });

  it('returns 403 when caller is not a student', async () => {
    const teacher = await createTeacherUser({ email: `t-403-${Date.now()}@example.com` });
    const teacherCookies = await signInAs(teacher.email, 'teacher');

    const res = await request(app)
      .get('/api/v1/dashboard/me/study-plan')
      .set('Cookie', teacherCookies);
    expect(res.status).toBe(403);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// POST /dashboard/me/study-plan
// ──────────────────────────────────────────────────────────────────────────────

describe('POST /dashboard/me/study-plan', () => {
  it('generates and persists a study plan for an unplaced student (no academic data)', async () => {
    const student = await createStudentUser({ email: `unplaced-${Date.now()}@example.com` });
    const studentCookies = await signInAs(student.email, 'student');

    const weekStart = currentWeekMonday();
    const planContent = buildValidPlanContent(weekStart);
    vi.mocked(generateJson).mockResolvedValueOnce(JSON.stringify(planContent));

    const res = await request(app)
      .post('/api/v1/dashboard/me/study-plan')
      .set('Cookie', studentCookies);

    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('active');
    expect(res.body.data.weekStart).toBe(weekStart);
    expect(res.body.data.content.summary).toBe(planContent.summary);
    expect(res.body.data.content.days).toHaveLength(7);
    expect(res.body.data.studentId).toBe(student.id);
    expect(generateJson).toHaveBeenCalledTimes(1);
  });

  it('generates a plan enriched with upcoming assessments and enrolled course data', async () => {
    const adminCookies = await signInAs('admin@example.com', 'admin');
    const program = await createProgram({ institutionType: 'college' });
    const cls = await createClass({ programId: program.id });
    const year = await createAcademicYear({ isCurrent: true, term: 'odd' });
    const section = await createSection({ classId: cls.id, academicYearId: year.id });
    const course = await createCourse({ classId: cls.id, title: 'Chemistry' });
    const batch = await createBatch({ programId: program.id });
    const student = await createStudentUser({ email: `s-enr-${Date.now()}@example.com` });
    const teacher = await createTeacherUser({ email: `t-enr-${Date.now()}@example.com` });
    await courseTeacherRepository.assign({ teacherId: teacher.id, courseId: course.id });
    await placeAndEnroll(adminCookies, student.id, section.id, course.id, batch.id);

    const teacherCookies = await signInAs(teacher.email, 'teacher');
    const studentCookies = await signInAs(student.email, 'student');

    // Create an assignment so the upcoming-assessments logic has something to find
    await request(app)
      .post(`/api/v1/courses/${course.id}/assignments`)
      .set('Cookie', teacherCookies)
      .send({
        title: 'Lab Report',
        prompt: 'Summarise the experiment.',
        rubric: [{ criterion: 'Accuracy', maxPoints: 10, description: 'Is it accurate?' }],
        dueAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days from now
      });

    const weekStart = currentWeekMonday();
    const planContent = {
      ...buildValidPlanContent(weekStart),
      evidence: {
        upcomingAssessments: 1,
        weakConcepts: 0,
        missingSubmissions: 0,
        averageGrade: null,
      },
    };
    vi.mocked(generateJson).mockResolvedValueOnce(JSON.stringify(planContent));

    const res = await request(app)
      .post('/api/v1/dashboard/me/study-plan')
      .set('Cookie', studentCookies);

    expect(res.status).toBe(201);
    expect(res.body.data.content.evidence.upcomingAssessments).toBe(1);

    // The prompt must have been called with the assignment title in it
    const [, userPrompt] = vi.mocked(generateJson).mock.calls[0] as [string, string, ...unknown[]];
    expect(userPrompt).toContain('Lab Report');
    expect(userPrompt).toContain('Chemistry');
  });

  it('supersedes the old active plan when the student regenerates', async () => {
    const student = await createStudentUser({ email: `regen-${Date.now()}@example.com` });
    const studentCookies = await signInAs(student.email, 'student');

    const weekStart = currentWeekMonday();
    const firstPlan = buildValidPlanContent(weekStart);
    const secondPlan = {
      ...buildValidPlanContent(weekStart),
      summary: 'Updated plan after new evidence.',
    };

    vi.mocked(generateJson)
      .mockResolvedValueOnce(JSON.stringify(firstPlan))
      .mockResolvedValueOnce(JSON.stringify(secondPlan));

    const first = await request(app)
      .post('/api/v1/dashboard/me/study-plan')
      .set('Cookie', studentCookies);
    expect(first.status).toBe(201);
    const firstId = first.body.data.id as string;

    const second = await request(app)
      .post('/api/v1/dashboard/me/study-plan')
      .set('Cookie', studentCookies);
    expect(second.status).toBe(201);

    // New plan is active with the new summary
    expect(second.body.data.id).not.toBe(firstId);
    expect(second.body.data.status).toBe('active');
    expect(second.body.data.content.summary).toBe('Updated plan after new evidence.');

    // GET must return the new plan
    const getRes = await request(app)
      .get('/api/v1/dashboard/me/study-plan')
      .set('Cookie', studentCookies);
    expect(getRes.body.data.id).toBe(second.body.data.id);
    expect(getRes.body.data.content.summary).toBe('Updated plan after new evidence.');
  });

  it('returns 502 when the LLM fails after retries', async () => {
    const student = await createStudentUser({ email: `fail-${Date.now()}@example.com` });
    const studentCookies = await signInAs(student.email, 'student');

    // Both attempts (initial + one retry) return invalid JSON
    vi.mocked(generateJson).mockResolvedValue('not valid json at all');

    const res = await request(app)
      .post('/api/v1/dashboard/me/study-plan')
      .set('Cookie', studentCookies);

    expect(res.status).toBe(502);
    expect(generateJson).toHaveBeenCalledTimes(2);
  });

  it('returns 401 for unauthenticated requests', async () => {
    const res = await request(app).post('/api/v1/dashboard/me/study-plan');
    expect(res.status).toBe(401);
  });

  it('returns 403 when caller is not a student', async () => {
    const teacher = await createTeacherUser({ email: `t-post-403-${Date.now()}@example.com` });
    const teacherCookies = await signInAs(teacher.email, 'teacher');

    const res = await request(app)
      .post('/api/v1/dashboard/me/study-plan')
      .set('Cookie', teacherCookies);
    expect(res.status).toBe(403);
  });
});
