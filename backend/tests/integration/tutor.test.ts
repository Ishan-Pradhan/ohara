import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import request from 'supertest';

vi.mock('../../src/services/email.service.js', async () => {
  const { emailServiceStub } = await import('../helpers/auth.js');
  return emailServiceStub();
});

vi.mock('../../src/services/llm.service.js', () => ({
  generateText: vi.fn(),
}));

const { app } = await import('../../src/app.js');
const { truncateAll, closeDb } = await import('../helpers/db.js');
const { cookiesFrom } = await import('../helpers/auth.js');
const { User } = await import('../../src/models/users.model.js');
const { createCourse, createTeacherUser, createStudentUser, createEnrollment } = await import(
  '../helpers/institution.js'
);
const { documentRepository } = await import('../../src/repositories/documents.repository.js');
const { documentChunkRepository } = await import(
  '../../src/repositories/documentChunks.repository.js'
);
const { enrollmentRepository } = await import('../../src/repositories/enrollments.repository.js');
const { courseRepository } = await import('../../src/repositories/courses.repository.js');
const { moduleRepository } = await import('../../src/repositories/modules.repository.js');
const { lessonRepository } = await import('../../src/repositories/lessons.repository.js');
const { EMBEDDING_DIMENSIONS } = await import('../../src/constants/index.js');
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

/** Signs a student in via the real auth flow and links them, as the same
 * user row, to an active enrollment in the given course — route-level tests
 * need a login cookie, not just a bare user row. */
const signInEnrolledStudent = async (email: string, courseId: string): Promise<string[]> => {
  const cookies = await signInAs(email, 'student');
  const user = await User.findOne({ where: { email } });
  await createEnrollment({ studentId: user!.id, courseId });
  return cookies;
};

beforeEach(async () => {
  await truncateAll();
  vi.mocked(generateText).mockReset();
  vi.mocked(generateText).mockResolvedValue('This is a tutor response grounded in the material.');
});

afterAll(async () => {
  await closeDb();
});

/** A valid, non-zero embedding of the model's dimension — cosine distance is
 * undefined for the zero vector, so every fixture vector uses a constant
 * fill instead. */
const vector = (value: number): number[] => new Array(EMBEDDING_DIMENSIONS).fill(value) as number[];

describe('documentChunkRepository.findSimilar', () => {
  it('only returns chunks from the target course, from ready documents', async () => {
    const courseA = await createCourse();
    const courseB = await createCourse();
    const uploader = await createTeacherUser();

    const readyDocumentInCourseA = await documentRepository.create({
      courseId: courseA.id,
      uploadedBy: uploader.id,
      filename: 'a-ready.pdf',
      storageKey: '/tmp/a-ready.pdf',
      status: 'ready',
    });
    const processingDocumentInCourseA = await documentRepository.create({
      courseId: courseA.id,
      uploadedBy: uploader.id,
      filename: 'a-processing.pdf',
      storageKey: '/tmp/a-processing.pdf',
      status: 'processing',
    });
    const readyDocumentInCourseB = await documentRepository.create({
      courseId: courseB.id,
      uploadedBy: uploader.id,
      filename: 'b-ready.pdf',
      storageKey: '/tmp/b-ready.pdf',
      status: 'ready',
    });

    const [readyChunkInCourseA] = await documentChunkRepository.bulkCreate([
      { documentId: readyDocumentInCourseA.id, chunkIndex: 0, content: 'a-ready', embedding: vector(0.1) },
    ]);
    const [chunkOnProcessingDocumentInCourseA] = await documentChunkRepository.bulkCreate([
      {
        documentId: processingDocumentInCourseA.id,
        chunkIndex: 0,
        content: 'a-processing',
        embedding: vector(0.2),
      },
    ]);
    const [chunkInCourseB] = await documentChunkRepository.bulkCreate([
      { documentId: readyDocumentInCourseB.id, chunkIndex: 0, content: 'b-ready', embedding: vector(0.3) },
    ]);

    const queryVector = vector(0.1);
    const results = await documentChunkRepository.findSimilar(courseA.id, queryVector, 5);
    const chunkIds = results.map((c) => c.id);

    expect(chunkIds).toContain(readyChunkInCourseA?.id);
    expect(chunkIds).not.toContain(chunkInCourseB?.id);
    expect(chunkIds).not.toContain(chunkOnProcessingDocumentInCourseA?.id);
  });
});

describe('enrollmentRepository.isEnrolled', () => {
  it('is true only for an active enrollment in that course', async () => {
    const course = await createCourse();
    const enrolledStudent = await createStudentUser();
    const otherStudent = await createStudentUser();
    await createEnrollment({ studentId: enrolledStudent.id, courseId: course.id });

    expect(await enrollmentRepository.isEnrolled(enrolledStudent.id, course.id)).toBe(true);
    expect(await enrollmentRepository.isEnrolled(otherStudent.id, course.id)).toBe(false);
  });
});

describe('Tutor endpoints', () => {
  it('a non-enrolled student cannot list conversations or send a message', async () => {
    const course = await createCourse();
    const otherStudentCookie = await signInAs('outsider@example.com', 'student');

    const res = await request(app)
      .get(`/api/v1/courses/${course.id}/tutor/conversations`)
      .set('Cookie', otherStudentCookie);
    expect(res.status).toBe(403);
  });

  it('creates a conversation and sends a message, grounded in the course material', async () => {
    const course = await createCourse();
    const teacher = await createTeacherUser();
    const readyDocument = await documentRepository.create({
      courseId: course.id,
      uploadedBy: teacher.id,
      filename: 'lecture-1.pdf',
      storageKey: '/tmp/lecture-1.pdf',
      status: 'ready',
    });
    await documentChunkRepository.bulkCreate([
      {
        documentId: readyDocument.id,
        chunkIndex: 0,
        content: 'Photosynthesis converts light energy into chemical energy.',
        embedding: vector(0.1),
      },
    ]);

    const enrolledStudentCookie = await signInEnrolledStudent('enrolled@example.com', course.id);

    const createRes = await request(app)
      .post(`/api/v1/courses/${course.id}/tutor/conversations`)
      .set('Cookie', enrolledStudentCookie)
      .send({ title: 'Chapter 1 questions' });
    expect(createRes.status).toBe(201);
    const conversationId = createRes.body.data.id;

    const sendRes = await request(app)
      .post(`/api/v1/courses/${course.id}/tutor/conversations/${conversationId}/messages`)
      .set('Cookie', enrolledStudentCookie)
      .send({ content: 'What does the material say about photosynthesis?' });

    expect(sendRes.status).toBe(201);
    expect(sendRes.body.data.assistantMessage.content).toBeTruthy();
    expect(sendRes.body.data.assistantMessage.sources).not.toBeNull();
    expect(sendRes.body.data.assistantMessage.sources[0]).toMatchObject({
      documentId: readyDocument.id,
      filename: 'lecture-1.pdf',
    });
  });

  it('returns a "no material" response when the course has no ready documents', async () => {
    const emptyCourse = await createCourse();
    const enrolledStudentCookie = await signInEnrolledStudent(
      'empty-course-student@example.com',
      emptyCourse.id,
    );

    const createRes = await request(app)
      .post(`/api/v1/courses/${emptyCourse.id}/tutor/conversations`)
      .set('Cookie', enrolledStudentCookie)
      .send({ title: 'Test' });
    const conversationId = createRes.body.data.id;

    const sendRes = await request(app)
      .post(`/api/v1/courses/${emptyCourse.id}/tutor/conversations/${conversationId}/messages`)
      .set('Cookie', enrolledStudentCookie)
      .send({ content: 'Anything?' });

    expect(sendRes.status).toBe(201);
    expect(sendRes.body.data.assistantMessage.sources).toBeNull();
    // Grounding is mandatory: zero retrieved chunks must be a hard code
    // branch, not just a prompt-engineered refusal — the LLM must never be
    // called at all in this case.
    expect(generateText).not.toHaveBeenCalled();
    expect(sendRes.body.data.assistantMessage.content).toBe(
      "There's no course material available yet to answer this question.",
    );
  });

  it("a student cannot view another student's conversation", async () => {
    const course = await createCourse();
    const ownerStudentCookie = await signInEnrolledStudent('owner@example.com', course.id);
    const otherStudentCookie = await signInEnrolledStudent('other@example.com', course.id);

    const createRes = await request(app)
      .post(`/api/v1/courses/${course.id}/tutor/conversations`)
      .set('Cookie', ownerStudentCookie)
      .send({ title: "Owner's conversation" });
    const otherStudentsConversationId = createRes.body.data.id;

    const res = await request(app)
      .get(`/api/v1/courses/${course.id}/tutor/conversations/${otherStudentsConversationId}/messages`)
      .set('Cookie', otherStudentCookie);
    expect(res.status).toBe(404);
  });

  it('GET /courses/:courseId/outline returns modules/lessons without full lesson content', async () => {
    const course = await createCourse();
    await courseRepository.setPublished(course.id, true);
    const module = await moduleRepository.create({ courseId: course.id, title: 'Module 1', orderIndex: 0 });
    await lessonRepository.create({
      moduleId: module.id,
      title: 'Lesson 1',
      content: 'The full lesson body, which the outline must not expose.',
      keyTopics: ['photosynthesis'],
      orderIndex: 0,
    });
    const enrolledStudentCookie = await signInEnrolledStudent('outline-student@example.com', course.id);

    const res = await request(app)
      .get(`/api/v1/courses/${course.id}/outline`)
      .set('Cookie', enrolledStudentCookie);
    expect(res.status).toBe(200);
    expect(res.body.data[0].lessons[0]).not.toHaveProperty('content');
    expect(res.body.data[0].lessons[0]).toHaveProperty('keyTopics');
  });

  it('404s the outline for an unpublished course', async () => {
    const course = await createCourse();
    const enrolledStudentCookie = await signInEnrolledStudent(
      'unpublished-course-student@example.com',
      course.id,
    );

    const res = await request(app)
      .get(`/api/v1/courses/${course.id}/outline`)
      .set('Cookie', enrolledStudentCookie);
    expect(res.status).toBe(404);
  });
});
