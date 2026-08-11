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

const setupCourseWithTeacherAndStudent = async () => {
  await createAcademicYear({ isCurrent: true });
  const course = await createCourse();
  const teacher = await createTeacherUser({ email: `teacher-${Date.now()}@example.com` });
  await courseTeacherRepository.assign({ teacherId: teacher.id, courseId: course.id });
  const student = await createStudentUser({ email: `student-${Date.now()}@example.com` });
  await createEnrollment({ studentId: student.id, courseId: course.id });

  const teacherCookies = await signInAs(teacher.email, 'teacher');
  const studentCookies = await signInAs(student.email, 'student');
  return { course, teacher, student, teacherCookies, studentCookies };
};

const validQuizJson = JSON.stringify({
  questions: [
    { type: 'mcq', prompt: 'What is 2+2?', options: ['3', '4', '5'], correctIndex: 1, points: 1 },
    { type: 'mcq', prompt: 'What is 3+3?', options: ['6', '7'], correctIndex: 0, points: 1 },
    { type: 'short_answer', prompt: 'Explain addition.', points: 1 },
  ],
});

const generateQuizAs = async (cookies: string[], courseId: string) => {
  return request(app)
    .post(`/api/v1/courses/${courseId}/quizzes/generate`)
    .set('Cookie', cookies)
    .send({ title: 'Arithmetic Quiz', topic: 'Basic addition', numQuestions: 3 });
};

beforeEach(async () => {
  await truncateAll();
  vi.mocked(generateJson).mockReset();
});

afterAll(async () => {
  await closeDb();
});

describe('POST /courses/:courseId/quizzes/generate', () => {
  it('rejects a student with 403', async () => {
    const { course, studentCookies } = await setupCourseWithTeacherAndStudent();
    const res = await generateQuizAs(studentCookies, course.id);
    expect(res.status).toBe(403);
  });

  it('generates a draft quiz with questions for an assigned teacher', async () => {
    const { course, teacherCookies } = await setupCourseWithTeacherAndStudent();
    vi.mocked(generateJson).mockResolvedValueOnce(validQuizJson);

    const res = await generateQuizAs(teacherCookies, course.id);
    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('draft');
    expect(res.body.data.questions).toHaveLength(3);
    expect(res.body.data.questions[0]).toMatchObject({ type: 'mcq', correctIndex: 1 });
  });
});

describe('Quiz review, publish, and visibility', () => {
  it('hides a draft quiz from students, shows it once published', async () => {
    const { course, teacherCookies, studentCookies } = await setupCourseWithTeacherAndStudent();
    vi.mocked(generateJson).mockResolvedValueOnce(validQuizJson);
    const created = await generateQuizAs(teacherCookies, course.id);
    const quizId = created.body.data.id;

    const listBefore = await request(app)
      .get(`/api/v1/courses/${course.id}/quizzes`)
      .set('Cookie', studentCookies);
    expect(listBefore.body.data).toHaveLength(0);

    const getBefore = await request(app)
      .get(`/api/v1/courses/${course.id}/quizzes/${quizId}`)
      .set('Cookie', studentCookies);
    expect(getBefore.status).toBe(404);

    const publishRes = await request(app)
      .patch(`/api/v1/courses/${course.id}/quizzes/${quizId}/publish`)
      .set('Cookie', teacherCookies)
      .send({ status: 'published' });
    expect(publishRes.status).toBe(200);

    const listAfter = await request(app)
      .get(`/api/v1/courses/${course.id}/quizzes`)
      .set('Cookie', studentCookies);
    expect(listAfter.body.data).toHaveLength(1);

    // Before attempting, the student can see the quiz but not the answers.
    const getAfter = await request(app)
      .get(`/api/v1/courses/${course.id}/quizzes/${quizId}`)
      .set('Cookie', studentCookies);
    expect(getAfter.status).toBe(200);
    expect(getAfter.body.data.questions.every((q: { correctIndex: null }) => q.correctIndex === null)).toBe(true);
  });

  it('lets a teacher edit a generated question before publishing', async () => {
    const { course, teacherCookies } = await setupCourseWithTeacherAndStudent();
    vi.mocked(generateJson).mockResolvedValueOnce(validQuizJson);
    const created = await generateQuizAs(teacherCookies, course.id);
    const quizId = created.body.data.id;
    const questionId = created.body.data.questions[0].id;

    const editRes = await request(app)
      .patch(`/api/v1/courses/${course.id}/quizzes/${quizId}/questions/${questionId}`)
      .set('Cookie', teacherCookies)
      .send({ prompt: 'What is 2 + 2, exactly?' });
    expect(editRes.status).toBe(200);
    expect(editRes.body.data.prompt).toBe('What is 2 + 2, exactly?');
  });
});

describe('Quiz attempts', () => {
  it('auto-scores MCQs, ignores short-answer scoring, blocks a second attempt, then reveals answers', async () => {
    const { course, teacherCookies, studentCookies } = await setupCourseWithTeacherAndStudent();
    vi.mocked(generateJson).mockResolvedValueOnce(validQuizJson);
    const created = await generateQuizAs(teacherCookies, course.id);
    const quizId = created.body.data.id;
    const [q1, q2, q3] = created.body.data.questions;

    await request(app)
      .patch(`/api/v1/courses/${course.id}/quizzes/${quizId}/publish`)
      .set('Cookie', teacherCookies)
      .send({ status: 'published' });

    const attemptRes = await request(app)
      .post(`/api/v1/courses/${course.id}/quizzes/${quizId}/attempts`)
      .set('Cookie', studentCookies)
      .send({
        responses: [
          { questionId: q1.id, answer: 1 }, // correct
          { questionId: q2.id, answer: 1 }, // wrong (correct is 0)
          { questionId: q3.id, answer: 'because you combine quantities' }, // short answer, ungraded
        ],
      });

    expect(attemptRes.status).toBe(201);
    expect(attemptRes.body.data.score).toBe(1);
    // maxScore covers every question's points (2 MCQ + 1 short-answer) from
    // the start; the short-answer's point isn't earned until a teacher
    // AI-grades and approves it (see the "Short-answer grading" tests below).
    expect(attemptRes.body.data.maxScore).toBe(3);
    const shortAnswerResult = attemptRes.body.data.results.find((r: { questionId: string }) => r.questionId === q3.id);
    expect(shortAnswerResult.grade).toMatchObject({ status: 'ungraded', awardedPoints: null });

    const again = await request(app)
      .post(`/api/v1/courses/${course.id}/quizzes/${quizId}/attempts`)
      .set('Cookie', studentCookies)
      .send({ responses: [{ questionId: q1.id, answer: 1 }] });
    expect(again.status).toBe(409);

    // Now that they've attempted, the quiz reveals correct answers.
    const getAfterAttempt = await request(app)
      .get(`/api/v1/courses/${course.id}/quizzes/${quizId}`)
      .set('Cookie', studentCookies);
    const revealedQ1 = getAfterAttempt.body.data.questions.find((q: { id: string }) => q.id === q1.id);
    expect(revealedQ1.correctIndex).toBe(1);

    // Teacher can see the attempt on the roster.
    const rosterRes = await request(app)
      .get(`/api/v1/courses/${course.id}/quizzes/${quizId}/attempts`)
      .set('Cookie', teacherCookies);
    expect(rosterRes.body.data).toHaveLength(1);
    expect(rosterRes.body.data[0].score).toBe(1);
  });
});

describe('Short-answer grading', () => {
  const setupAttemptedQuiz = async () => {
    const { course, teacherCookies, studentCookies, student } = await setupCourseWithTeacherAndStudent();
    vi.mocked(generateJson).mockResolvedValueOnce(validQuizJson);
    const created = await generateQuizAs(teacherCookies, course.id);
    const quizId = created.body.data.id;
    const [q1, q2, q3] = created.body.data.questions;

    await request(app)
      .patch(`/api/v1/courses/${course.id}/quizzes/${quizId}/publish`)
      .set('Cookie', teacherCookies)
      .send({ status: 'published' });

    const attemptRes = await request(app)
      .post(`/api/v1/courses/${course.id}/quizzes/${quizId}/attempts`)
      .set('Cookie', studentCookies)
      .send({
        responses: [
          { questionId: q1.id, answer: 1 },
          { questionId: q2.id, answer: 0 },
          { questionId: q3.id, answer: 'Addition combines two quantities into a sum.' },
        ],
      });

    return { course, teacherCookies, studentCookies, student, quizId, q3, attemptId: attemptRes.body.data.id };
  };

  it('rejects a student trying to grade', async () => {
    const { course, studentCookies, quizId, attemptId, q3 } = await setupAttemptedQuiz();
    const res = await request(app)
      .post(`/api/v1/courses/${course.id}/quizzes/${quizId}/attempts/${attemptId}/questions/${q3.id}/grade`)
      .set('Cookie', studentCookies);
    expect(res.status).toBe(403);
  });

  it('AI-grades a draft (hidden from the student), then approving it updates the score and reveals it', async () => {
    const { course, teacherCookies, studentCookies, quizId, attemptId, q3 } = await setupAttemptedQuiz();

    vi.mocked(generateJson).mockResolvedValueOnce(
      JSON.stringify({ awardedPoints: 1, feedback: 'Correct and clear.' }),
    );
    const gradeRes = await request(app)
      .post(`/api/v1/courses/${course.id}/quizzes/${quizId}/attempts/${attemptId}/questions/${q3.id}/grade`)
      .set('Cookie', teacherCookies);
    expect(gradeRes.status).toBe(200);
    expect(gradeRes.body.data).toMatchObject({ status: 'draft', awardedPoints: 1, maxPoints: 1 });

    // Draft grade doesn't move the score yet, and is hidden from the student.
    // (Both MCQ responses in setupAttemptedQuiz are correct — score starts at 2.)
    const myAttemptDraft = await request(app)
      .get(`/api/v1/courses/${course.id}/quizzes/${quizId}/attempts/me`)
      .set('Cookie', studentCookies);
    expect(myAttemptDraft.body.data.score).toBe(2);
    const draftResult = myAttemptDraft.body.data.results.find((r: { questionId: string }) => r.questionId === q3.id);
    expect(draftResult.grade).toMatchObject({ status: 'draft', awardedPoints: null, feedback: null });

    // Teacher approves.
    const approveRes = await request(app)
      .patch(`/api/v1/courses/${course.id}/quizzes/${quizId}/attempts/${attemptId}/questions/${q3.id}/grade`)
      .set('Cookie', teacherCookies)
      .send({ awardedPoints: 1, feedback: 'Correct and clear.', status: 'approved' });
    expect(approveRes.status).toBe(200);
    expect(approveRes.body.data.status).toBe('approved');

    // Score now includes it, and the student can see the feedback.
    const myAttemptApproved = await request(app)
      .get(`/api/v1/courses/${course.id}/quizzes/${quizId}/attempts/me`)
      .set('Cookie', studentCookies);
    expect(myAttemptApproved.body.data.score).toBe(3);
    const approvedResult = myAttemptApproved.body.data.results.find((r: { questionId: string }) => r.questionId === q3.id);
    expect(approvedResult.grade).toMatchObject({
      status: 'approved',
      awardedPoints: 1,
      feedback: 'Correct and clear.',
    });

    // The gradebook-facing roster reflects the same updated total.
    const rosterRes = await request(app)
      .get(`/api/v1/courses/${course.id}/quizzes/${quizId}/attempts`)
      .set('Cookie', teacherCookies);
    expect(rosterRes.body.data[0].score).toBe(3);

    // Regrading an approved response is blocked.
    const regradeRes = await request(app)
      .post(`/api/v1/courses/${course.id}/quizzes/${quizId}/attempts/${attemptId}/questions/${q3.id}/grade`)
      .set('Cookie', teacherCookies);
    expect(regradeRes.status).toBe(409);
  });

  it('grade-short-answers bulk-grades every ungraded short-answer response', async () => {
    const { course, teacherCookies, quizId, q3 } = await setupAttemptedQuiz();

    vi.mocked(generateJson).mockResolvedValueOnce(
      JSON.stringify({ awardedPoints: 0.5, feedback: 'Partially correct.' }),
    );
    const bulkRes = await request(app)
      .post(`/api/v1/courses/${course.id}/quizzes/${quizId}/grade-short-answers`)
      .set('Cookie', teacherCookies);

    expect(bulkRes.status).toBe(200);
    expect(bulkRes.body.data).toMatchObject({ total: 1, graded: 1, failed: 0 });

    const rosterRes = await request(app)
      .get(`/api/v1/courses/${course.id}/quizzes/${quizId}/attempts`)
      .set('Cookie', teacherCookies);
    const graded = rosterRes.body.data[0].results.find((r: { questionId: string }) => r.questionId === q3.id);
    expect(graded.grade).toMatchObject({ status: 'draft', awardedPoints: 0.5 });

    // A second bulk run has nothing left to grade.
    const secondBulkRes = await request(app)
      .post(`/api/v1/courses/${course.id}/quizzes/${quizId}/grade-short-answers`)
      .set('Cookie', teacherCookies);
    expect(secondBulkRes.body.data).toMatchObject({ total: 0, graded: 0 });
  });
});
