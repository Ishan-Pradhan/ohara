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

const RUBRIC = [{ criterion: 'Quality', maxPoints: 10, description: 'Overall quality' }];

beforeEach(async () => {
  await truncateAll();
  vi.mocked(generateJson).mockReset();
});

afterAll(async () => {
  await closeDb();
});

describe('Notifications', () => {
  it('notifies an enrolled student when an assignment is created, a quiz is published, and a grade is approved', async () => {
    const { course, teacherCookies, studentCookies } = await setupCourseWithTeacherAndStudent();

    // 1. Creating an assignment notifies the student.
    const assignmentRes = await request(app)
      .post(`/api/v1/courses/${course.id}/assignments`)
      .set('Cookie', teacherCookies)
      .send({
        title: 'Essay 1',
        prompt: 'Explain photosynthesis.',
        rubric: RUBRIC,
        dueAt: new Date(Date.now() + 3600_000).toISOString(),
      });
    const assignmentId = assignmentRes.body.data.id;

    // 2. Publishing a quiz notifies the student.
    const quizRes = await request(app)
      .post(`/api/v1/courses/${course.id}/quizzes`)
      .set('Cookie', teacherCookies)
      .send({ title: 'Quiz 1' });
    const quizId = quizRes.body.data.id;
    await request(app)
      .patch(`/api/v1/courses/${course.id}/quizzes/${quizId}/publish`)
      .set('Cookie', teacherCookies)
      .send({ status: 'published' });
    // Publishing again must not create a duplicate notification.
    await request(app)
      .patch(`/api/v1/courses/${course.id}/quizzes/${quizId}/publish`)
      .set('Cookie', teacherCookies)
      .send({ status: 'published' });

    let listRes = await request(app).get('/api/v1/notifications').set('Cookie', studentCookies);
    expect(listRes.body.data).toHaveLength(2);
    expect(listRes.body.data.map((n: { type: string }) => n.type).sort()).toEqual([
      'assignment_created',
      'quiz_published',
    ]);
    expect(listRes.body.data.every((n: { isRead: boolean }) => n.isRead === false)).toBe(true);

    let unreadRes = await request(app)
      .get('/api/v1/notifications/unread-count')
      .set('Cookie', studentCookies);
    expect(unreadRes.body.data.count).toBe(2);

    // 3. Submitting + AI-grading + approving a submission notifies the student
    //    (draft grading must NOT notify — only the approval).
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
        criterionFeedback: [{ criterion: 'Quality', awardedPoints: 9, feedback: 'Great.' }],
        overallFeedback: 'Great work.',
      }),
    );
    await request(app)
      .post(`/api/v1/courses/${course.id}/assignments/${assignmentId}/submissions/${submissionId}/grade`)
      .set('Cookie', teacherCookies);

    // Draft grade exists but isn't approved yet — no new notification.
    unreadRes = await request(app)
      .get('/api/v1/notifications/unread-count')
      .set('Cookie', studentCookies);
    expect(unreadRes.body.data.count).toBe(2);

    await request(app)
      .patch(`/api/v1/courses/${course.id}/assignments/${assignmentId}/submissions/${submissionId}/grade`)
      .set('Cookie', teacherCookies)
      .send({
        criterionFeedback: [{ criterion: 'Quality', maxPoints: 10, awardedPoints: 9, feedback: 'Great.' }],
        status: 'approved',
      });

    listRes = await request(app).get('/api/v1/notifications').set('Cookie', studentCookies);
    expect(listRes.body.data).toHaveLength(3);
    const gradedNotification = listRes.body.data.find(
      (n: { type: string }) => n.type === 'assignment_graded',
    );
    expect(gradedNotification.link).toBe(`/student/courses/${course.id}/assignments/${assignmentId}`);

    // 4. Mark one as read, then mark all as read.
    await request(app)
      .patch(`/api/v1/notifications/${gradedNotification.id}/read`)
      .set('Cookie', studentCookies)
      .expect(200);
    unreadRes = await request(app)
      .get('/api/v1/notifications/unread-count')
      .set('Cookie', studentCookies);
    expect(unreadRes.body.data.count).toBe(2);

    await request(app).patch('/api/v1/notifications/read-all').set('Cookie', studentCookies);
    unreadRes = await request(app)
      .get('/api/v1/notifications/unread-count')
      .set('Cookie', studentCookies);
    expect(unreadRes.body.data.count).toBe(0);
  });

  it("rejects marking another user's notification as read with 403", async () => {
    const { course, teacherCookies, studentCookies } = await setupCourseWithTeacherAndStudent();
    await request(app)
      .post(`/api/v1/courses/${course.id}/assignments`)
      .set('Cookie', teacherCookies)
      .send({
        title: 'Essay 1',
        prompt: 'Explain photosynthesis.',
        rubric: RUBRIC,
        dueAt: new Date(Date.now() + 3600_000).toISOString(),
      });

    const listRes = await request(app).get('/api/v1/notifications').set('Cookie', studentCookies);
    const notificationId = listRes.body.data[0].id;

    const otherStudent = await createStudentUser({ email: `other-${Date.now()}@example.com` });
    const otherCookies = await signInAs(otherStudent.email, 'student');

    const res = await request(app)
      .patch(`/api/v1/notifications/${notificationId}/read`)
      .set('Cookie', otherCookies);
    expect(res.status).toBe(403);
  });
});
