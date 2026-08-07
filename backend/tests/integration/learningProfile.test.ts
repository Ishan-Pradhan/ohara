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

describe('GET /dashboard/me/learning-profile', () => {
  it('returns a grounded learning profile from deterministic evidence and AI interpretation', async () => {
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

    const teacherCookies = await signInAs(teacher.email, 'teacher');
    const studentCookies = await signInAs(student.email, 'student');

    const assignmentRes = await request(app)
      .post(`/api/v1/courses/${course.id}/assignments`)
      .set('Cookie', teacherCookies)
      .send({
        title: 'Essay 1',
        prompt: 'Explain photosynthesis.',
        rubric: RUBRIC,
        dueAt: new Date(Date.now() - 3600_000).toISOString(),
      });
    const assignmentId = assignmentRes.body.data.id;

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
    await request(app)
      .post(`/api/v1/courses/${course.id}/quizzes/${quizId}/attempts`)
      .set('Cookie', studentCookies)
      .send({ responses: [{ questionId, answer: 1 }] });

    await request(app)
      .post(`/api/v1/courses/${course.id}/attendance/sessions`)
      .set('Cookie', teacherCookies)
      .send({ sectionId: section.id, sessionDate: '2026-08-01', records: [{ studentId: student.id, status: 'present' }] });

    vi.mocked(generateJson).mockResolvedValueOnce(
      JSON.stringify({
        summary: 'You are performing well overall.',
        strengths: ['Strong attendance', 'Good quiz performance'],
        attentionAreas: ['Finish the remaining assignments'],
        nextActions: ['Complete missing work', 'Keep attending class'],
        courseInsights: [
          {
            courseId: course.id,
            courseTitle: 'Physics',
            status: 'developing',
            note: 'Quiz and assignment evidence are mostly positive, but there is still room to tighten consistency.',
          },
        ],
      }),
    );

    const res = await request(app)
      .get('/api/v1/dashboard/me/learning-profile')
      .set('Cookie', studentCookies);

    expect(res.status).toBe(200);
    expect(res.body.data.snapshot.status).toBe('ready');
    expect(res.body.data.snapshot.averageGrade).toBeCloseTo(81.8181818, 5);
    expect(res.body.data.snapshot.attendancePercentage).toBe(100);
    expect(res.body.data.profile.summary).toBe('You are performing well overall.');
    expect(res.body.data.profile.strengths).toContain('Strong attendance');
    expect(res.body.data.profile.courseInsights[0]).toMatchObject({
      courseId: course.id,
      courseTitle: 'Physics',
      status: 'developing',
    });
    expect(generateJson).toHaveBeenCalledTimes(2);

    const forbidden = await request(app)
      .get('/api/v1/dashboard/me/learning-profile')
      .set('Cookie', teacherCookies);
    expect(forbidden.status).toBe(403);
  });
});
