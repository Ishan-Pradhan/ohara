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
const { courseTeacherRepository } = await import('../../src/repositories/courseTeachers.repository.js');

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

beforeEach(async () => {
  await truncateAll();
  vi.resetAllMocks();
});

afterAll(async () => {
  await closeDb();
});

describe('GET /dashboard/me/concepts', () => {
  it('returns an empty concept inventory for a placed student with no lesson topics and no quizzes', async () => {
    const adminCookies = await signInAs('admin@example.com', 'admin');
    const program = await createProgram({ institutionType: 'college' });
    const cls = await createClass({ programId: program.id });
    const year = await createAcademicYear({ isCurrent: true, term: 'odd' });
    const section = await createSection({ classId: cls.id, academicYearId: year.id });
    const course = await createCourse({ classId: cls.id, title: 'Physics' });
    const batch = await createBatch({ programId: program.id });
    const student = await createStudentUser({ email: `student-${Date.now()}@example.com` });
    const teacher = await createTeacherUser({ email: `teacher-${Date.now()}@example.com` });
    await courseTeacherRepository.assign({ teacherId: teacher.id, courseId: course.id });

    await placeAndEnroll(adminCookies, student.id, section.id, course.id, batch.id);

    const studentCookies = await signInAs(student.email, 'student');

    const res = await request(app)
      .get('/api/v1/dashboard/me/concepts')
      .set('Cookie', studentCookies);

    expect(res.status).toBe(200);
    expect(res.body.data.totalConcepts).toBe(0);
    expect(res.body.data.conceptsWithEvidence).toBe(0);
    expect(res.body.data.courses).toHaveLength(1);
    expect(res.body.data.courses[0].courseTitle).toBe('Physics');
    expect(res.body.data.courses[0].concepts).toHaveLength(0);
    expect(res.body.data.courses[0].hasTopics).toBe(false);
    expect(res.body.data.courses[0].hasQuizEvidence).toBe(false);
  });

  it('surfaces lesson keyTopics and reflects insufficient_data mastery when no quiz is attempted', async () => {
    const adminCookies = await signInAs('admin@example.com', 'admin');
    const program = await createProgram({ institutionType: 'college' });
    const cls = await createClass({ programId: program.id });
    const year = await createAcademicYear({ isCurrent: true, term: 'odd' });
    const section = await createSection({ classId: cls.id, academicYearId: year.id });
    const course = await createCourse({ classId: cls.id, title: 'Biology' });
    const batch = await createBatch({ programId: program.id });
    const student = await createStudentUser({ email: `student2-${Date.now()}@example.com` });
    const teacher = await createTeacherUser({ email: `teacher2-${Date.now()}@example.com` });
    await courseTeacherRepository.assign({ teacherId: teacher.id, courseId: course.id });

    await placeAndEnroll(adminCookies, student.id, section.id, course.id, batch.id);

    const teacherCookies = await signInAs(teacher.email, 'teacher');
    const studentCookies = await signInAs(student.email, 'student');

    // Create a module with a lesson that has keyTopics
    const moduleRes = await request(app)
      .post(`/api/v1/courses/${course.id}/modules`)
      .set('Cookie', teacherCookies)
      .send({ title: 'Unit 1 — Cell Biology', orderIndex: 0 });
    const moduleId = moduleRes.body.data.id as string;

    await request(app)
      .post(`/api/v1/courses/${course.id}/modules/${moduleId}/lessons`)
      .set('Cookie', teacherCookies)
      .send({
        title: 'Cell Structure',
        content: 'Cells are the basic unit of life.',
        keyTopics: ['Cell membrane', 'Nucleus', 'Mitochondria'],
        orderIndex: 0,
      });

    const res = await request(app)
      .get('/api/v1/dashboard/me/concepts')
      .set('Cookie', studentCookies);

    expect(res.status).toBe(200);
    expect(res.body.data.totalConcepts).toBe(3);
    expect(res.body.data.conceptsWithEvidence).toBe(0);

    const biologyCourse = res.body.data.courses[0];
    expect(biologyCourse.hasTopics).toBe(true);
    expect(biologyCourse.hasQuizEvidence).toBe(false);

    const topics = biologyCourse.concepts.map((c: { topic: string }) => c.topic);
    expect(topics).toContain('Cell membrane');
    expect(topics).toContain('Nucleus');
    expect(topics).toContain('Mitochondria');

    for (const concept of biologyCourse.concepts) {
      expect(concept.masteryState).toBe('insufficient_data');
      expect(concept.evidenceType).toBe('none');
    }
  });

  it('returns mastery states derived from quiz attempt scores', async () => {
    const adminCookies = await signInAs('admin@example.com', 'admin');
    const program = await createProgram({ institutionType: 'college' });
    const cls = await createClass({ programId: program.id });
    const year = await createAcademicYear({ isCurrent: true, term: 'odd' });
    const section = await createSection({ classId: cls.id, academicYearId: year.id });
    const course = await createCourse({ classId: cls.id, title: 'Chemistry' });
    const batch = await createBatch({ programId: program.id });
    const student = await createStudentUser({ email: `student3-${Date.now()}@example.com` });
    const teacher = await createTeacherUser({ email: `teacher3-${Date.now()}@example.com` });
    await courseTeacherRepository.assign({ teacherId: teacher.id, courseId: course.id });

    await placeAndEnroll(adminCookies, student.id, section.id, course.id, batch.id);

    const teacherCookies = await signInAs(teacher.email, 'teacher');
    const studentCookies = await signInAs(student.email, 'student');

    // Create a module + lesson with topics
    const moduleRes = await request(app)
      .post(`/api/v1/courses/${course.id}/modules`)
      .set('Cookie', teacherCookies)
      .send({ title: 'Module 1', orderIndex: 0 });
    const moduleId = moduleRes.body.data.id as string;

    await request(app)
      .post(`/api/v1/courses/${course.id}/modules/${moduleId}/lessons`)
      .set('Cookie', teacherCookies)
      .send({
        title: 'Periodic Table',
        content: 'Elements and their properties.',
        keyTopics: ['Atomic number', 'Valence electrons'],
        orderIndex: 0,
      });

    // Create and publish a quiz with one MCQ question (2 points)
    const quizRes = await request(app)
      .post(`/api/v1/courses/${course.id}/quizzes`)
      .set('Cookie', teacherCookies)
      .send({ title: 'Quiz 1' });
    const quizId = quizRes.body.data.id as string;

    const questionRes = await request(app)
      .post(`/api/v1/courses/${course.id}/quizzes/${quizId}/questions`)
      .set('Cookie', teacherCookies)
      .send({
        type: 'mcq',
        prompt: 'What is the atomic number of Hydrogen?',
        options: ['0', '1', '2'],
        correctIndex: 1,
        points: 2,
        orderIndex: 0,
      });
    const questionId = questionRes.body.data.id as string;

    await request(app)
      .patch(`/api/v1/courses/${course.id}/quizzes/${quizId}/publish`)
      .set('Cookie', teacherCookies)
      .send({ status: 'published' });

    // Student answers correctly → score = 2/2 = 100% → strong
    await request(app)
      .post(`/api/v1/courses/${course.id}/quizzes/${quizId}/attempts`)
      .set('Cookie', studentCookies)
      .send({ responses: [{ questionId, answer: 1 }] });

    const res = await request(app)
      .get('/api/v1/dashboard/me/concepts')
      .set('Cookie', studentCookies);

    expect(res.status).toBe(200);

    const chemCourse = res.body.data.courses[0];
    expect(chemCourse.hasQuizEvidence).toBe(true);
    expect(chemCourse.quizEvidence.attemptedCount).toBe(1);
    expect(chemCourse.quizEvidence.averageScorePercentage).toBeCloseTo(100, 1);

    for (const concept of chemCourse.concepts) {
      expect(concept.masteryState).toBe('strong');
      expect(concept.evidenceType).toBe('indirect');
    }

    expect(res.body.data.totalConcepts).toBe(2);
    expect(res.body.data.conceptsWithEvidence).toBe(2);
  });

  it('returns 401 for unauthenticated requests', async () => {
    const res = await request(app).get('/api/v1/dashboard/me/concepts');
    expect(res.status).toBe(401);
  });

  it('returns 403 when caller is not a student', async () => {
    const teacher = await createTeacherUser({ email: `teacher-rbac-${Date.now()}@example.com` });
    const teacherCookies = await signInAs(teacher.email, 'teacher');

    const res = await request(app)
      .get('/api/v1/dashboard/me/concepts')
      .set('Cookie', teacherCookies);
    expect(res.status).toBe(403);
  });

  it('returns an empty inventory (not an error) for a placed student with no enrollment', async () => {
    const student = await createStudentUser({ email: `unplaced-${Date.now()}@example.com` });
    const studentCookies = await signInAs(student.email, 'student');

    const res = await request(app)
      .get('/api/v1/dashboard/me/concepts')
      .set('Cookie', studentCookies);

    expect(res.status).toBe(200);
    expect(res.body.data.totalConcepts).toBe(0);
    expect(res.body.data.courses).toHaveLength(0);
  });
});
