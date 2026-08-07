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
const { generateJson } = await import('../../src/services/llm.service.js');

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────

const PASSWORD = 'hunter2secret';

type Role = 'admin' | 'teacher' | 'student';

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

/** Set up a course with a teacher, an enrolled student, and an unrelated student. */
const setupCourse = async () => {
  const course = await createCourse({ title: 'Physics', code: `PHYS-${Date.now()}` });
  const teacher = await createTeacherUser({ email: `teacher-${Date.now()}@example.com` });
  await courseTeacherRepository.assign({ teacherId: teacher.id, courseId: course.id });
  const student = await createStudentUser({ email: `student-${Date.now()}@example.com` });
  await createEnrollment({ studentId: student.id, courseId: course.id });
  const otherStudent = await createStudentUser({
    email: `other-${Date.now()}@example.com`,
  });

  const teacherCookies = await signInAs(teacher.email, 'teacher');
  const studentCookies = await signInAs(student.email, 'student');
  const otherCookies = await signInAs(otherStudent.email, 'student');

  return { course, teacher, student, otherStudent, teacherCookies, studentCookies, otherCookies };
};

/** Create, publish, and return a quiz via the teacher API. */
const createAndPublishQuiz = async (
  teacherCookies: string[],
  courseId: string,
): Promise<string> => {
  vi.mocked(generateJson).mockResolvedValueOnce(
    JSON.stringify({
      questions: [
        {
          type: 'mcq',
          prompt: 'What is 2+2?',
          options: ['3', '4', '5'],
          correctIndex: 1,
          points: 1,
        },
        {
          type: 'mcq',
          prompt: 'Capital of France?',
          options: ['London', 'Paris', 'Berlin'],
          correctIndex: 1,
          points: 1,
        },
      ],
    }),
  );

  const genRes = await request(app)
    .post(`/api/v1/courses/${courseId}/quizzes/generate`)
    .set('Cookie', teacherCookies)
    .send({ title: 'Physics Quiz 1', topic: 'Basic physics', numQuestions: 2 });

  const quizId = genRes.body.data.id;

  await request(app)
    .patch(`/api/v1/courses/${courseId}/quizzes/${quizId}/publish`)
    .set('Cookie', teacherCookies)
    .send({ status: 'published' });

  return quizId;
};

/** Create an assignment via the teacher API and return its id. */
const createAssignment = async (
  teacherCookies: string[],
  courseId: string,
): Promise<string> => {
  const res = await request(app)
    .post(`/api/v1/courses/${courseId}/assignments`)
    .set('Cookie', teacherCookies)
    .send({
      title: 'Essay on Newton',
      prompt: "Write a 500-word essay on Newton's laws.",
      rubric: [
        { criterion: 'Clarity', maxPoints: 5, description: 'Clear and concise writing' },
        { criterion: 'Accuracy', maxPoints: 5, description: 'Scientifically accurate' },
      ],
      dueAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    });
  return res.body.data.id;
};

const mockValidAIResponse = () => {
  vi.mocked(generateJson).mockResolvedValue(
    JSON.stringify({
      explanation: 'You are developing. Focus on the weak areas.',
      recommendations: ['Review Chapter 1', 'Practice MCQ questions'],
    }),
  );
};

// ──────────────────────────────────────────────────────────────────────────────
// Setup / teardown
// ──────────────────────────────────────────────────────────────────────────────

beforeEach(async () => {
  await truncateAll();
  vi.mocked(generateJson).mockReset();
});

afterAll(async () => {
  await closeDb();
});

// ──────────────────────────────────────────────────────────────────────────────
// GET /dashboard/me/exam-prep — auth guards
// ──────────────────────────────────────────────────────────────────────────────

describe('GET /dashboard/me/exam-prep — auth guards', () => {
  it('returns 401 when not authenticated', async () => {
    const res = await request(app).get(
      '/api/v1/dashboard/me/exam-prep?assessmentType=quiz&assessmentId=550e8400-e29b-41d4-a716-446655440001',
    );
    expect(res.status).toBe(401);
  });

  it('returns 403 for a teacher (student-only endpoint)', async () => {
    const teacher = await createTeacherUser({ email: `t-${Date.now()}@example.com` });
    const cookies = await signInAs(teacher.email, 'teacher');
    const res = await request(app)
      .get(
        '/api/v1/dashboard/me/exam-prep?assessmentType=quiz&assessmentId=550e8400-e29b-41d4-a716-446655440001',
      )
      .set('Cookie', cookies);
    expect(res.status).toBe(403);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// GET /dashboard/me/exam-prep — validation
// ──────────────────────────────────────────────────────────────────────────────

describe('GET /dashboard/me/exam-prep — validation', () => {
  it('returns 400 when assessmentType is missing', async () => {
    const { studentCookies } = await setupCourse();
    const res = await request(app)
      .get(
        '/api/v1/dashboard/me/exam-prep?assessmentId=550e8400-e29b-41d4-a716-446655440001',
      )
      .set('Cookie', studentCookies);
    expect(res.status).toBe(400);
  });

  it('returns 400 when assessmentId is not a valid UUID', async () => {
    const { studentCookies } = await setupCourse();
    const res = await request(app)
      .get('/api/v1/dashboard/me/exam-prep?assessmentType=quiz&assessmentId=not-a-uuid')
      .set('Cookie', studentCookies);
    expect(res.status).toBe(400);
  });

  it('returns 400 when assessmentType is invalid', async () => {
    const { studentCookies } = await setupCourse();
    const res = await request(app)
      .get(
        '/api/v1/dashboard/me/exam-prep?assessmentType=exam&assessmentId=550e8400-e29b-41d4-a716-446655440001',
      )
      .set('Cookie', studentCookies);
    expect(res.status).toBe(400);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// GET /dashboard/me/exam-prep — not found / not enrolled
// ──────────────────────────────────────────────────────────────────────────────

describe('GET /dashboard/me/exam-prep — not found / not enrolled', () => {
  it('returns 404 for a quiz that does not exist', async () => {
    const { studentCookies } = await setupCourse();
    // Use a well-formed UUID that doesn't exist in the DB
    const res = await request(app)
      .get(
        '/api/v1/dashboard/me/exam-prep?assessmentType=quiz&assessmentId=550e8400-e29b-41d4-a716-446655440000',
      )
      .set('Cookie', studentCookies);
    expect(res.status).toBe(404);
  });

  it('returns 403 when the student is not enrolled in the quiz\'s course', async () => {
    const { course, teacherCookies, otherCookies } = await setupCourse();
    const quizId = await createAndPublishQuiz(teacherCookies, course.id);

    vi.mocked(generateJson).mockReset();

    const res = await request(app)
      .get(`/api/v1/dashboard/me/exam-prep?assessmentType=quiz&assessmentId=${quizId}`)
      .set('Cookie', otherCookies);
    expect(res.status).toBe(403);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// GET /dashboard/me/exam-prep — quiz (no prior attempt)
// ──────────────────────────────────────────────────────────────────────────────

describe('GET /dashboard/me/exam-prep — quiz with no prior attempt', () => {
  it('returns insufficient_data readiness with null AI when no attempt exists', async () => {
    const { course, teacherCookies, studentCookies } = await setupCourse();
    const quizId = await createAndPublishQuiz(teacherCookies, course.id);

    vi.mocked(generateJson).mockReset();

    const res = await request(app)
      .get(`/api/v1/dashboard/me/exam-prep?assessmentType=quiz&assessmentId=${quizId}`)
      .set('Cookie', studentCookies);

    expect(res.status).toBe(200);
    const body = res.body.data;
    expect(body.assessmentType).toBe('quiz');
    expect(body.readinessState).toBe('insufficient_data');
    expect(body.readinessScore).toBeNull();
    expect(body.alreadyCompleted).toBe(false);
    // No AI when insufficient_data
    expect(body.ai).toBeNull();
    expect(body.weakAreas).toEqual([]);
    expect(body.evidence.alreadyAttempted).toBe(false);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// GET /dashboard/me/exam-prep — quiz (after attempt)
// ──────────────────────────────────────────────────────────────────────────────

describe('GET /dashboard/me/exam-prep — quiz with prior attempt', () => {
  it('returns readiness based on MCQ performance and invokes AI explanation', async () => {
    const { course, teacherCookies, studentCookies } = await setupCourse();

    // Create and publish a 2-question MCQ quiz
    const quizId = await createAndPublishQuiz(teacherCookies, course.id);

    vi.mocked(generateJson).mockReset();

    // Fetch the quiz to get question IDs
    const quizRes = await request(app)
      .get(`/api/v1/courses/${course.id}/quizzes/${quizId}`)
      .set('Cookie', studentCookies);
    const questions = quizRes.body.data.questions as Array<{ id: string }>;

    // Submit an attempt answering first question correctly, second incorrectly
    await request(app)
      .post(`/api/v1/courses/${course.id}/quizzes/${quizId}/attempts`)
      .set('Cookie', studentCookies)
      .send({
        responses: [
          { questionId: questions[0]!.id, answer: 1 }, // correct (correctIndex: 1)
          { questionId: questions[1]!.id, answer: 0 }, // wrong (correctIndex: 1)
        ],
      });

    // Mock AI response for the exam prep call
    mockValidAIResponse();

    const res = await request(app)
      .get(`/api/v1/dashboard/me/exam-prep?assessmentType=quiz&assessmentId=${quizId}`)
      .set('Cookie', studentCookies);

    expect(res.status).toBe(200);
    const body = res.body.data;
    expect(body.assessmentType).toBe('quiz');
    expect(body.assessmentId).toBe(quizId);
    expect(body.alreadyCompleted).toBe(true);
    // 1/2 correct = 50% → needs_attention
    expect(body.readinessState).toBe('needs_attention');
    expect(body.readinessScore).toBeCloseTo(50, 0);
    // One wrong answer → should appear in weakAreas
    expect(body.weakAreas.length).toBeGreaterThan(0);
    expect(body.weakAreas.some((a: string) => a.startsWith('Question:'))).toBe(true);
    // AI should be populated
    expect(body.ai).not.toBeNull();
    expect(body.ai.explanation).toBeTruthy();
    expect(body.ai.recommendations).toBeInstanceOf(Array);
    expect(body.ai.recommendations.length).toBeGreaterThan(0);
  });

  it('returns ready state when student answered all MCQs correctly', async () => {
    const { course, teacherCookies, studentCookies } = await setupCourse();
    const quizId = await createAndPublishQuiz(teacherCookies, course.id);

    vi.mocked(generateJson).mockReset();

    const quizRes = await request(app)
      .get(`/api/v1/courses/${course.id}/quizzes/${quizId}`)
      .set('Cookie', studentCookies);
    const questions = quizRes.body.data.questions as Array<{ id: string }>;

    // Answer both correctly (correctIndex: 1 for both)
    await request(app)
      .post(`/api/v1/courses/${course.id}/quizzes/${quizId}/attempts`)
      .set('Cookie', studentCookies)
      .send({
        responses: [
          { questionId: questions[0]!.id, answer: 1 },
          { questionId: questions[1]!.id, answer: 1 },
        ],
      });

    mockValidAIResponse();

    const res = await request(app)
      .get(`/api/v1/dashboard/me/exam-prep?assessmentType=quiz&assessmentId=${quizId}`)
      .set('Cookie', studentCookies);

    expect(res.status).toBe(200);
    const body = res.body.data;
    // 2/2 correct = 100% → ready
    expect(body.readinessState).toBe('ready');
    expect(body.readinessScore).toBeCloseTo(100, 0);
    // No wrong answers in this quiz
    expect(body.weakAreas.filter((a: string) => a.startsWith('Question:'))).toHaveLength(0);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// GET /dashboard/me/exam-prep — assignment
// ──────────────────────────────────────────────────────────────────────────────

describe('GET /dashboard/me/exam-prep — assignment with no submission', () => {
  it('returns insufficient_data when student has not submitted', async () => {
    const { course, teacherCookies, studentCookies } = await setupCourse();
    const assignmentId = await createAssignment(teacherCookies, course.id);

    const res = await request(app)
      .get(
        `/api/v1/dashboard/me/exam-prep?assessmentType=assignment&assessmentId=${assignmentId}`,
      )
      .set('Cookie', studentCookies);

    expect(res.status).toBe(200);
    const body = res.body.data;
    expect(body.assessmentType).toBe('assignment');
    expect(body.alreadyCompleted).toBe(false);
    expect(body.readinessState).toBe('insufficient_data');
    expect(body.readinessScore).toBeNull();
    expect(body.ai).toBeNull();
    // Rubric criteria are still shown even without submission history
    expect(body.evidence.rubricCriteria).toBeGreaterThan(0);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// GET /dashboard/me/exam-prep — AI fallback
// ──────────────────────────────────────────────────────────────────────────────

describe('GET /dashboard/me/exam-prep — AI graceful degradation', () => {
  it('returns deterministic data with ai=null when LLM call fails', async () => {
    const { course, teacherCookies, studentCookies } = await setupCourse();
    const quizId = await createAndPublishQuiz(teacherCookies, course.id);

    vi.mocked(generateJson).mockReset();

    const quizRes = await request(app)
      .get(`/api/v1/courses/${course.id}/quizzes/${quizId}`)
      .set('Cookie', studentCookies);
    const questions = quizRes.body.data.questions as Array<{ id: string }>;

    await request(app)
      .post(`/api/v1/courses/${course.id}/quizzes/${quizId}/attempts`)
      .set('Cookie', studentCookies)
      .send({
        responses: [
          { questionId: questions[0]!.id, answer: 0 },
          { questionId: questions[1]!.id, answer: 0 },
        ],
      });

    // Simulate LLM failure on all retries
    vi.mocked(generateJson).mockRejectedValue(new Error('LLM network error'));

    const res = await request(app)
      .get(`/api/v1/dashboard/me/exam-prep?assessmentType=quiz&assessmentId=${quizId}`)
      .set('Cookie', studentCookies);

    // Should still succeed — deterministic data is returned, ai is null
    expect(res.status).toBe(200);
    const body = res.body.data;
    expect(body.readinessState).not.toBe('insufficient_data');
    expect(body.ai).toBeNull();
  });
});
