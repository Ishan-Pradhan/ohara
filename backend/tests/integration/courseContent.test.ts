import path from 'node:path';
import { fileURLToPath } from 'node:url';
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
const { Module } = await import('../../src/models/modules.model.js');
const { Lesson } = await import('../../src/models/lessons.model.js');
const { createCourse, createTeacherUser } = await import('../helpers/institution.js');
const { courseTeacherRepository } = await import(
  '../../src/repositories/courseTeachers.repository.js'
);
const { documentRepository } = await import('../../src/repositories/documents.repository.js');
const { generateJson } = await import('../../src/services/llm.service.js');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SAMPLE_PDF = path.join(__dirname, '..', 'fixtures', 'sample.pdf');

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

const validStructureJson = JSON.stringify({
  modules: [
    {
      title: 'Photosynthesis',
      lessons: [
        {
          title: 'Light-dependent reactions',
          content: 'Plants convert light energy into chemical energy.',
          keyTopics: ['chlorophyll', 'ATP'],
        },
        {
          title: 'Calvin cycle',
          content: 'Carbon fixation produces glucose.',
          keyTopics: ['carbon fixation'],
        },
      ],
    },
  ],
});

/** Creates a document row that's already "ready", pointing at the real
 * sample fixture on disk — skips the ingestion pipeline entirely (that's
 * documents.test.ts's job), so these tests only exercise course-content
 * behavior. */
const createReadyDocument = async (courseId: string, uploadedBy: string) =>
  documentRepository.create({
    courseId,
    uploadedBy,
    filename: 'sample.pdf',
    storageKey: SAMPLE_PDF,
    status: 'ready',
  });

beforeEach(async () => {
  await truncateAll();
  vi.mocked(generateJson).mockReset();
});

afterAll(async () => {
  await closeDb();
});

describe('POST /courses/:courseId/documents/:documentId/generate', () => {
  it('rejects an unauthenticated caller with 401', async () => {
    const course = await createCourse();
    const admin = await createTeacherUser({ email: 'x@example.com' });
    const document = await createReadyDocument(course.id, admin.id);
    const res = await request(app).post(
      `/api/v1/courses/${course.id}/documents/${document.id}/generate`,
    );
    expect(res.status).toBe(401);
  });

  it('rejects a teacher not assigned to the course with 403', async () => {
    const course = await createCourse();
    const admin = await createTeacherUser({ email: 'x@example.com' });
    const document = await createReadyDocument(course.id, admin.id);
    const cookies = await signInAs('outsider@example.com', 'teacher');

    const res = await request(app)
      .post(`/api/v1/courses/${course.id}/documents/${document.id}/generate`)
      .set('Cookie', cookies);
    expect(res.status).toBe(403);
  });

  it('allows a teacher assigned to the course', async () => {
    const course = await createCourse();
    const teacher = await createTeacherUser({ email: 'owner@example.com' });
    await courseTeacherRepository.assign({ teacherId: teacher.id, courseId: course.id });
    const document = await createReadyDocument(course.id, teacher.id);
    const cookies = await signInAs(teacher.email, 'teacher');
    vi.mocked(generateJson).mockResolvedValueOnce(validStructureJson);

    const res = await request(app)
      .post(`/api/v1/courses/${course.id}/documents/${document.id}/generate`)
      .set('Cookie', cookies);
    expect(res.status).toBe(201);
  });

  it("404s when the document doesn't belong to this course", async () => {
    const courseA = await createCourse();
    const courseB = await createCourse();
    const admin = await createTeacherUser({ email: 'x@example.com' });
    const document = await createReadyDocument(courseA.id, admin.id);
    const cookies = await signInAs('admin@example.com', 'admin');

    const res = await request(app)
      .post(`/api/v1/courses/${courseB.id}/documents/${document.id}/generate`)
      .set('Cookie', cookies);
    expect(res.status).toBe(404);
  });

  it('rejects a document that has not finished processing with 400', async () => {
    const course = await createCourse();
    const admin = await createTeacherUser({ email: 'x@example.com' });
    const document = await documentRepository.create({
      courseId: course.id,
      uploadedBy: admin.id,
      filename: 'sample.pdf',
      storageKey: SAMPLE_PDF,
      status: 'processing',
    });
    const cookies = await signInAs('admin@example.com', 'admin');

    const res = await request(app)
      .post(`/api/v1/courses/${course.id}/documents/${document.id}/generate`)
      .set('Cookie', cookies);
    expect(res.status).toBe(400);
  });

  it('generates and persists modules with nested lessons on success', async () => {
    const course = await createCourse();
    const admin = await createTeacherUser({ email: 'x@example.com' });
    const document = await createReadyDocument(course.id, admin.id);
    const cookies = await signInAs('admin@example.com', 'admin');
    vi.mocked(generateJson).mockResolvedValueOnce(validStructureJson);

    const res = await request(app)
      .post(`/api/v1/courses/${course.id}/documents/${document.id}/generate`)
      .set('Cookie', cookies);

    expect(res.status).toBe(201);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0]).toMatchObject({ title: 'Photosynthesis', orderIndex: 0 });
    expect(res.body.data[0].lessons).toHaveLength(2);
    expect(res.body.data[0].lessons[0]).toMatchObject({
      title: 'Light-dependent reactions',
      keyTopics: ['chlorophyll', 'ATP'],
      orderIndex: 0,
    });

    const modules = await Module.findAll({ where: { courseId: course.id } });
    expect(modules).toHaveLength(1);
    const lessons = await Lesson.findAll({ where: { moduleId: modules[0]?.id } });
    expect(lessons).toHaveLength(2);
  });

  it('appends rather than replacing on a second generation', async () => {
    const course = await createCourse();
    const admin = await createTeacherUser({ email: 'x@example.com' });
    const document = await createReadyDocument(course.id, admin.id);
    const cookies = await signInAs('admin@example.com', 'admin');

    vi.mocked(generateJson).mockResolvedValueOnce(validStructureJson);
    await request(app)
      .post(`/api/v1/courses/${course.id}/documents/${document.id}/generate`)
      .set('Cookie', cookies);

    vi.mocked(generateJson).mockResolvedValueOnce(validStructureJson);
    const second = await request(app)
      .post(`/api/v1/courses/${course.id}/documents/${document.id}/generate`)
      .set('Cookie', cookies);

    expect(second.body.data[0].orderIndex).toBe(1);
    const modules = await Module.findAll({ where: { courseId: course.id } });
    expect(modules).toHaveLength(2);
  });

  it('retries once on invalid JSON, then succeeds', async () => {
    const course = await createCourse();
    const admin = await createTeacherUser({ email: 'x@example.com' });
    const document = await createReadyDocument(course.id, admin.id);
    const cookies = await signInAs('admin@example.com', 'admin');

    vi.mocked(generateJson)
      .mockResolvedValueOnce('not valid json')
      .mockResolvedValueOnce(validStructureJson);

    const res = await request(app)
      .post(`/api/v1/courses/${course.id}/documents/${document.id}/generate`)
      .set('Cookie', cookies);

    expect(res.status).toBe(201);
    expect(generateJson).toHaveBeenCalledTimes(2);
  });

  it('returns 502 and creates nothing if the LLM never produces a valid structure', async () => {
    const course = await createCourse();
    const admin = await createTeacherUser({ email: 'x@example.com' });
    const document = await createReadyDocument(course.id, admin.id);
    const cookies = await signInAs('admin@example.com', 'admin');

    vi.mocked(generateJson)
      .mockResolvedValueOnce('not valid json')
      .mockResolvedValueOnce('still not valid');

    const res = await request(app)
      .post(`/api/v1/courses/${course.id}/documents/${document.id}/generate`)
      .set('Cookie', cookies);

    expect(res.status).toBe(502);
    expect(await Module.count({ where: { courseId: course.id } })).toBe(0);
  });
});

describe('Modules CRUD', () => {
  it('creates, updates, and deletes a module, rejecting cross-course access', async () => {
    const course = await createCourse();
    const otherCourse = await createCourse();
    const cookies = await signInAs('admin@example.com', 'admin');

    const createRes = await request(app)
      .post(`/api/v1/courses/${course.id}/modules`)
      .set('Cookie', cookies)
      .send({ title: 'Intro', orderIndex: 0 });
    expect(createRes.status).toBe(201);
    const moduleId = createRes.body.data.id;

    const updateRes = await request(app)
      .patch(`/api/v1/courses/${course.id}/modules/${moduleId}`)
      .set('Cookie', cookies)
      .send({ title: 'Introduction' });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.data.title).toBe('Introduction');

    const wrongCourseRes = await request(app)
      .delete(`/api/v1/courses/${otherCourse.id}/modules/${moduleId}`)
      .set('Cookie', cookies);
    expect(wrongCourseRes.status).toBe(404);

    const deleteRes = await request(app)
      .delete(`/api/v1/courses/${course.id}/modules/${moduleId}`)
      .set('Cookie', cookies);
    expect(deleteRes.status).toBe(200);
    expect(await Module.findByPk(moduleId)).toBeNull();
  });
});

describe('Lessons CRUD', () => {
  it('creates, updates, and deletes a lesson, rejecting a mismatched module/course', async () => {
    const course = await createCourse();
    const cookies = await signInAs('admin@example.com', 'admin');

    const moduleRes = await request(app)
      .post(`/api/v1/courses/${course.id}/modules`)
      .set('Cookie', cookies)
      .send({ title: 'Intro', orderIndex: 0 });
    const moduleId = moduleRes.body.data.id;

    const createRes = await request(app)
      .post(`/api/v1/courses/${course.id}/modules/${moduleId}/lessons`)
      .set('Cookie', cookies)
      .send({ title: 'Lesson 1', content: 'Some content', orderIndex: 0 });
    expect(createRes.status).toBe(201);
    const lessonId = createRes.body.data.id;

    const updateRes = await request(app)
      .patch(`/api/v1/courses/${course.id}/modules/${moduleId}/lessons/${lessonId}`)
      .set('Cookie', cookies)
      .send({ keyTopics: ['photosynthesis'] });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.data.keyTopics).toEqual(['photosynthesis']);

    const otherCourse = await createCourse();
    const wrongScopeRes = await request(app)
      .delete(`/api/v1/courses/${otherCourse.id}/modules/${moduleId}/lessons/${lessonId}`)
      .set('Cookie', cookies);
    expect(wrongScopeRes.status).toBe(404);

    const deleteRes = await request(app)
      .delete(`/api/v1/courses/${course.id}/modules/${moduleId}/lessons/${lessonId}`)
      .set('Cookie', cookies);
    expect(deleteRes.status).toBe(200);
    expect(await Lesson.findByPk(lessonId)).toBeNull();
  });
});

describe('PATCH /courses/:courseId/publish', () => {
  it('toggles isPublished', async () => {
    const course = await createCourse();
    const cookies = await signInAs('admin@example.com', 'admin');

    const publishRes = await request(app)
      .patch(`/api/v1/courses/${course.id}/publish`)
      .set('Cookie', cookies)
      .send({ isPublished: true });
    expect(publishRes.status).toBe(200);
    expect(publishRes.body.data.isPublished).toBe(true);

    const unpublishRes = await request(app)
      .patch(`/api/v1/courses/${course.id}/publish`)
      .set('Cookie', cookies)
      .send({ isPublished: false });
    expect(unpublishRes.body.data.isPublished).toBe(false);
  });

  it('rejects a student with 403', async () => {
    const course = await createCourse();
    const cookies = await signInAs('student@example.com', 'student');
    const res = await request(app)
      .patch(`/api/v1/courses/${course.id}/publish`)
      .set('Cookie', cookies)
      .send({ isPublished: true });
    expect(res.status).toBe(403);
  });
});
