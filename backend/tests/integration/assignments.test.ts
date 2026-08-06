import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import request from 'supertest';

vi.mock('../../src/services/email.service.js', async () => {
  const { emailServiceStub } = await import('../helpers/auth.js');
  return emailServiceStub();
});

vi.mock('../../src/services/llm.service.js', () => ({
  generateJson: vi.fn(),
}));

vi.mock('../../src/services/cloudinary.service.js', () => ({
  uploadBuffer: vi.fn(async () => ({
    url: 'https://res.cloudinary.com/test/raw/upload/v1/submissions/fake.pdf',
    publicId: 'submissions/fake',
  })),
  deleteFile: vi.fn(async () => undefined),
  downloadBuffer: vi.fn(async () => Buffer.from('fake file bytes')),
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

/** A course with an assigned teacher and an enrolled student, ready to
 * exercise the assignment/submission/grading loop. */
const setupCourseWithTeacherAndStudent = async () => {
  const course = await createCourse();
  const teacher = await createTeacherUser({ email: `teacher-${Date.now()}@example.com` });
  await courseTeacherRepository.assign({ teacherId: teacher.id, courseId: course.id });
  const student = await createStudentUser({ email: `student-${Date.now()}@example.com` });
  await createEnrollment({ studentId: student.id, courseId: course.id });

  const teacherCookies = await signInAs(teacher.email, 'teacher');
  const studentCookies = await signInAs(student.email, 'student');
  return { course, teacher, student, teacherCookies, studentCookies };
};

const RUBRIC = [
  { criterion: 'Clarity', maxPoints: 5, description: 'Is the writing clear?' },
  { criterion: 'Correctness', maxPoints: 5, description: 'Is the answer correct?' },
];

const createAssignmentAs = async (cookies: string[], courseId: string) => {
  const res = await request(app)
    .post(`/api/v1/courses/${courseId}/assignments`)
    .set('Cookie', cookies)
    .send({
      title: 'Essay 1',
      prompt: 'Explain photosynthesis.',
      rubric: RUBRIC,
      dueAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    });
  return res;
};

const validGradingJson = JSON.stringify({
  criterionFeedback: [
    { criterion: 'Clarity', awardedPoints: 4, feedback: 'Mostly clear.' },
    { criterion: 'Correctness', awardedPoints: 5, feedback: 'Fully correct.' },
  ],
  overallFeedback: 'Good work overall.',
});

beforeEach(async () => {
  await truncateAll();
  vi.mocked(generateJson).mockReset();
});

afterAll(async () => {
  await closeDb();
});

describe('POST /courses/:courseId/assignments', () => {
  it('rejects a student with 403', async () => {
    const { course, studentCookies } = await setupCourseWithTeacherAndStudent();
    const res = await createAssignmentAs(studentCookies, course.id);
    expect(res.status).toBe(403);
  });

  it('lets an assigned teacher create an assignment', async () => {
    const { course, teacherCookies } = await setupCourseWithTeacherAndStudent();
    const res = await createAssignmentAs(teacherCookies, course.id);
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ title: 'Essay 1', courseId: course.id });
    expect(res.body.data.rubric).toHaveLength(2);
  });
});

describe('GET /courses/:courseId/assignments', () => {
  it('is visible to the enrolled student and the assigned teacher, not an outsider', async () => {
    const { course, teacherCookies, studentCookies } = await setupCourseWithTeacherAndStudent();
    await createAssignmentAs(teacherCookies, course.id);

    const asStudent = await request(app)
      .get(`/api/v1/courses/${course.id}/assignments`)
      .set('Cookie', studentCookies);
    expect(asStudent.status).toBe(200);
    expect(asStudent.body.data).toHaveLength(1);

    const outsiderCookies = await signInAs(`outsider-${Date.now()}@example.com`, 'student');
    const asOutsider = await request(app)
      .get(`/api/v1/courses/${course.id}/assignments`)
      .set('Cookie', outsiderCookies);
    expect(asOutsider.status).toBe(403);
  });
});

describe('Submission + AI grading loop', () => {
  it('submits, blocks resubmission after approval, grades via AI, and hides draft grades from the student', async () => {
    const { course, teacherCookies, studentCookies } = await setupCourseWithTeacherAndStudent();
    const created = await createAssignmentAs(teacherCookies, course.id);
    const assignmentId = created.body.data.id;

    // Student submits.
    const submitRes = await request(app)
      .post(`/api/v1/courses/${course.id}/assignments/${assignmentId}/submissions`)
      .set('Cookie', studentCookies)
      .field('content', 'Photosynthesis converts light into chemical energy.');
    expect(submitRes.status).toBe(201);
    expect(submitRes.body.data.grade).toBeNull();

    // Teacher lists submissions, sees exactly one.
    const listRes = await request(app)
      .get(`/api/v1/courses/${course.id}/assignments/${assignmentId}/submissions`)
      .set('Cookie', teacherCookies);
    expect(listRes.status).toBe(200);
    expect(listRes.body.data).toHaveLength(1);
    const submissionId = listRes.body.data[0].id;

    // Teacher triggers AI grading.
    vi.mocked(generateJson).mockResolvedValueOnce(validGradingJson);
    const gradeRes = await request(app)
      .post(`/api/v1/courses/${course.id}/assignments/${assignmentId}/submissions/${submissionId}/grade`)
      .set('Cookie', teacherCookies);
    expect(gradeRes.status).toBe(200);
    expect(gradeRes.body.data.status).toBe('draft');
    expect(gradeRes.body.data.score).toBe(9);

    // Student still sees no grade — it's only a draft.
    const myRes1 = await request(app)
      .get(`/api/v1/courses/${course.id}/assignments/${assignmentId}/submissions/me`)
      .set('Cookie', studentCookies);
    expect(myRes1.body.data.grade).toBeNull();

    // Teacher approves.
    const approveRes = await request(app)
      .patch(`/api/v1/courses/${course.id}/assignments/${assignmentId}/submissions/${submissionId}/grade`)
      .set('Cookie', teacherCookies)
      .send({
        criterionFeedback: [
          { criterion: 'Clarity', maxPoints: 5, awardedPoints: 4, feedback: 'Mostly clear.' },
          { criterion: 'Correctness', maxPoints: 5, awardedPoints: 5, feedback: 'Fully correct.' },
        ],
        overallFeedback: 'Good work overall.',
        status: 'approved',
      });
    expect(approveRes.status).toBe(200);
    expect(approveRes.body.data.status).toBe('approved');

    // Now the student can see the approved grade.
    const myRes2 = await request(app)
      .get(`/api/v1/courses/${course.id}/assignments/${assignmentId}/submissions/me`)
      .set('Cookie', studentCookies);
    expect(myRes2.body.data.grade).toMatchObject({ status: 'approved', score: 9 });

    // Resubmission is now blocked.
    const resubmitRes = await request(app)
      .post(`/api/v1/courses/${course.id}/assignments/${assignmentId}/submissions`)
      .set('Cookie', studentCookies)
      .field('content', 'A revised answer.');
    expect(resubmitRes.status).toBe(409);
  });

  it('clamps an over-awarded AI score to the rubric max and recomputes the total', async () => {
    const { course, teacherCookies, studentCookies } = await setupCourseWithTeacherAndStudent();
    const created = await createAssignmentAs(teacherCookies, course.id);
    const assignmentId = created.body.data.id;

    await request(app)
      .post(`/api/v1/courses/${course.id}/assignments/${assignmentId}/submissions`)
      .set('Cookie', studentCookies)
      .field('content', 'An answer.');

    const listRes = await request(app)
      .get(`/api/v1/courses/${course.id}/assignments/${assignmentId}/submissions`)
      .set('Cookie', teacherCookies);
    const submissionId = listRes.body.data[0].id;

    vi.mocked(generateJson).mockResolvedValueOnce(
      JSON.stringify({
        criterionFeedback: [
          { criterion: 'Clarity', awardedPoints: 999, feedback: 'Way too generous.' },
          { criterion: 'Correctness', awardedPoints: 3, feedback: 'Mostly right.' },
        ],
        overallFeedback: 'Overall fine.',
      }),
    );
    const gradeRes = await request(app)
      .post(`/api/v1/courses/${course.id}/assignments/${assignmentId}/submissions/${submissionId}/grade`)
      .set('Cookie', teacherCookies);

    expect(gradeRes.status).toBe(200);
    const clarity = gradeRes.body.data.criterionFeedback.find(
      (c: { criterion: string }) => c.criterion === 'Clarity',
    );
    expect(clarity.awardedPoints).toBe(5);
    expect(gradeRes.body.data.score).toBe(8);
  });
});
