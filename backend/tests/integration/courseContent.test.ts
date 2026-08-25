import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import request from 'supertest';
import PDFDocument from 'pdfkit';

vi.mock('../../src/services/email.service.js', async () => {
  const { emailServiceStub } = await import('../helpers/auth.js');
  return emailServiceStub();
});

vi.mock('../../src/services/llm.service.js', () => ({
  generateJson: vi.fn(),
}));

vi.mock('../../src/services/embeddings.service.js', () => ({
  embed: vi.fn(),
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
const { courseRepository } = await import('../../src/repositories/courses.repository.js');
const { documentChunkRepository } = await import(
  '../../src/repositories/documentChunks.repository.js'
);
const { generateJson } = await import('../../src/services/llm.service.js');
const { embed } = await import('../../src/services/embeddings.service.js');
const { EMBEDDING_DIMENSIONS } = await import('../../src/constants/index.js');

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

// Generation is two phases now (see courseContent.controller.ts): one
// skeleton call over the whole document, then one content call per module
// (covering all of that module's lessons in one response).
const validSkeletonJson = JSON.stringify({
  modules: [
    {
      title: 'Photosynthesis',
      lessons: [
        { title: 'Light-dependent reactions', keyTopics: ['chlorophyll', 'ATP'] },
        { title: 'Calvin cycle', keyTopics: ['carbon fixation'] },
      ],
    },
  ],
});

const moduleContentJson = (lessons: { title: string; content: string }[]) =>
  JSON.stringify({ lessons });

const defaultModuleContent = moduleContentJson([
  { title: 'Light-dependent reactions', content: 'Plants convert light energy into chemical energy.' },
  { title: 'Calvin cycle', content: 'Carbon fixation produces glucose.' },
]);

/** Queues one skeleton response followed by one module-content response —
 * the exact call sequence a successful generation makes for the single-module
 * validSkeletonJson fixture above. */
const mockSuccessfulGeneration = (moduleContent = defaultModuleContent) => {
  vi.mocked(generateJson).mockResolvedValueOnce(validSkeletonJson);
  vi.mocked(generateJson).mockResolvedValueOnce(moduleContent);
};

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

/** Generates a minimal one-page PDF containing exactly the given text, saved
 * to a fresh temp file — used to create a "syllabus" document with content
 * distinct from SAMPLE_PDF, so a test can assert the skeleton call's prompt
 * came from the syllabus and not from the document being structured. */
const createPdfFile = (text: string): Promise<string> =>
  new Promise((resolve, reject) => {
    const filePath = path.join(os.tmpdir(), `${randomUUID()}.pdf`);
    const doc = new PDFDocument();
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => {
      fs.writeFile(filePath, Buffer.concat(chunks)).then(() => resolve(filePath)).catch(reject);
    });
    doc.on('error', reject);
    doc.text(text);
    doc.end();
  });

/** Creates a "ready" document backed by a distinct, generated PDF — for the
 * syllabus-document tests, which need content that's clearly not
 * SAMPLE_PDF's. */
const createReadySyllabusDocument = async (
  courseId: string,
  uploadedBy: string,
  text: string,
) => {
  const filePath = await createPdfFile(text);
  return documentRepository.create({
    courseId,
    uploadedBy,
    filename: 'official-syllabus.pdf',
    storageKey: filePath,
    status: 'ready',
  });
};

/** A valid, non-zero embedding of the model's dimension — cosine distance is
 * undefined for the zero vector. Mirrors tests/integration/tutor.test.ts. */
const vector = (value: number): number[] => new Array(EMBEDDING_DIMENSIONS).fill(value) as number[];

beforeEach(async () => {
  await truncateAll();
  vi.mocked(generateJson).mockReset();
  vi.mocked(embed).mockReset();
  vi.mocked(embed).mockImplementation(async (texts: string[]) => texts.map(() => vector(0.1)));
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
    mockSuccessfulGeneration();

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
    mockSuccessfulGeneration();

    const res = await request(app)
      .post(`/api/v1/courses/${course.id}/documents/${document.id}/generate`)
      .set('Cookie', cookies);

    expect(res.status).toBe(201);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0]).toMatchObject({ title: 'Photosynthesis', orderIndex: 0 });
    expect(res.body.data[0].lessons).toHaveLength(2);
    expect(res.body.data[0].lessons[0]).toMatchObject({
      title: 'Light-dependent reactions',
      content: 'Plants convert light energy into chemical energy.',
      keyTopics: ['chlorophyll', 'ATP'],
      orderIndex: 0,
    });
    expect(res.body.data[0].lessons[1]).toMatchObject({
      title: 'Calvin cycle',
      content: 'Carbon fixation produces glucose.',
    });

    const modules = await Module.findAll({ where: { courseId: course.id } });
    expect(modules).toHaveLength(1);
    const lessons = await Lesson.findAll({ where: { moduleId: modules[0]?.id } });
    expect(lessons).toHaveLength(2);
  });

  it('grounds module content generation in RAG-retrieved chunks, not the whole document', async () => {
    // Regression test for the Groq 413 "request too large" fix: module
    // content generation must search the document's own chunks (embedding
    // the module's lesson titles/topics as the query) instead of sending
    // the full extracted text, which is what originally exceeded Groq's
    // on_demand tier's per-request token cap on anything beyond a few pages.
    const course = await createCourse();
    const admin = await createTeacherUser({ email: 'x@example.com' });
    const document = await createReadyDocument(course.id, admin.id);
    await documentChunkRepository.bulkCreate([
      {
        documentId: document.id,
        chunkIndex: 0,
        content: 'Chlorophyll absorbs light and passes energy to the electron transport chain.',
        embedding: vector(0.1),
      },
    ]);
    const cookies = await signInAs('admin@example.com', 'admin');
    mockSuccessfulGeneration();

    const res = await request(app)
      .post(`/api/v1/courses/${course.id}/documents/${document.id}/generate`)
      .set('Cookie', cookies);

    expect(res.status).toBe(201);
    // First call is the skeleton (whole-document); second is this module's
    // content call — its prompt must contain the retrieved chunk, not the
    // (irrelevant, fixture-only) full sample.pdf text.
    const [, moduleContentUserPrompt] = vi.mocked(generateJson).mock.calls[1]!;
    expect(moduleContentUserPrompt).toContain(
      'Chlorophyll absorbs light and passes energy to the electron transport chain.',
    );
  });

  it('falls back to a short source-text slice when the document has no chunks', async () => {
    // createReadyDocument never chunks the document (that's
    // documents.test.ts's job) — this is the fallback path every other test
    // in this file already exercises implicitly; asserted explicitly here
    // so the fallback itself has direct coverage.
    const course = await createCourse();
    const admin = await createTeacherUser({ email: 'x@example.com' });
    const document = await createReadyDocument(course.id, admin.id);
    const cookies = await signInAs('admin@example.com', 'admin');
    mockSuccessfulGeneration();

    const res = await request(app)
      .post(`/api/v1/courses/${course.id}/documents/${document.id}/generate`)
      .set('Cookie', cookies);

    expect(res.status).toBe(201);
    expect(embed).toHaveBeenCalled();
    const [, moduleContentUserPrompt] = vi.mocked(generateJson).mock.calls[1]!;
    // sample.pdf's real extracted text — just needs to be non-empty and
    // short (capped by MODULE_CONTENT_SOURCE_FALLBACK_CHARS), not empty.
    expect((moduleContentUserPrompt as string).length).toBeGreaterThan(0);
  });

  it("uses the course's syllabus document to drive the skeleton, not the target document, when one is set", async () => {
    // Regression test for the "structure must match the official syllabus"
    // fix: when Course.syllabusDocumentId is set, the skeleton call's
    // prompt must be built from THAT document's text, not the document
    // being structured (:documentId in the URL) — even though both are
    // "ready" documents that could otherwise be confused.
    const course = await createCourse();
    const admin = await createTeacherUser({ email: 'x@example.com' });
    const targetDocument = await createReadyDocument(course.id, admin.id);
    const syllabusMarker = 'UNIT 1: Photosynthesis — Light reactions and Calvin cycle. UNIT 2: Cellular respiration.';
    const syllabusDocument = await createReadySyllabusDocument(course.id, admin.id, syllabusMarker);
    await courseRepository.setSyllabusDocument(course.id, syllabusDocument.id);
    const cookies = await signInAs('admin@example.com', 'admin');
    mockSuccessfulGeneration();

    const res = await request(app)
      .post(`/api/v1/courses/${course.id}/documents/${targetDocument.id}/generate`)
      .set('Cookie', cookies);

    expect(res.status).toBe(201);
    const [skeletonSystemPrompt, skeletonUserPrompt] = vi.mocked(generateJson).mock.calls[0]!;
    expect(skeletonUserPrompt).toContain(syllabusMarker);
    // The extraction-mode system prompt, not the invent-a-grouping one —
    // distinguishing language from courseSkeletonFromSyllabusSystemPrompt.
    expect(skeletonSystemPrompt).toContain('TRANSCRIPTION task, not a design task');
  });

  it('falls back to inventing structure from the target document when no syllabus document is set', async () => {
    const course = await createCourse();
    const admin = await createTeacherUser({ email: 'x@example.com' });
    const document = await createReadyDocument(course.id, admin.id);
    const cookies = await signInAs('admin@example.com', 'admin');
    mockSuccessfulGeneration();

    const res = await request(app)
      .post(`/api/v1/courses/${course.id}/documents/${document.id}/generate`)
      .set('Cookie', cookies);

    expect(res.status).toBe(201);
    const [skeletonSystemPrompt] = vi.mocked(generateJson).mock.calls[0]!;
    expect(skeletonSystemPrompt).not.toContain('TRANSCRIPTION task');
  });

  it('appends rather than replacing on a second generation', async () => {
    const course = await createCourse();
    const admin = await createTeacherUser({ email: 'x@example.com' });
    const document = await createReadyDocument(course.id, admin.id);
    const cookies = await signInAs('admin@example.com', 'admin');

    const firstBatchContent = moduleContentJson([
      { title: 'Light-dependent reactions', content: 'First lesson content.' },
      { title: 'Calvin cycle', content: 'Second lesson content.' },
    ]);
    mockSuccessfulGeneration(firstBatchContent);
    await request(app)
      .post(`/api/v1/courses/${course.id}/documents/${document.id}/generate`)
      .set('Cookie', cookies);

    mockSuccessfulGeneration(firstBatchContent);
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

    // Skeleton call is invalid once, then retries successfully; the module
    // content call succeeds on the first try.
    vi.mocked(generateJson)
      .mockResolvedValueOnce('not valid json')
      .mockResolvedValueOnce(validSkeletonJson)
      .mockResolvedValueOnce(defaultModuleContent);

    const res = await request(app)
      .post(`/api/v1/courses/${course.id}/documents/${document.id}/generate`)
      .set('Cookie', cookies);

    expect(res.status).toBe(201);
    expect(generateJson).toHaveBeenCalledTimes(3);
  });

  it('falls back to a placeholder for a module whose content call never succeeds, without failing the whole generation', async () => {
    const course = await createCourse();
    const admin = await createTeacherUser({ email: 'x@example.com' });
    const document = await createReadyDocument(course.id, admin.id);
    const cookies = await signInAs('admin@example.com', 'admin');

    vi.mocked(generateJson)
      .mockResolvedValueOnce(validSkeletonJson)
      .mockResolvedValueOnce('not valid json')
      .mockResolvedValueOnce('still not valid json');

    const res = await request(app)
      .post(`/api/v1/courses/${course.id}/documents/${document.id}/generate`)
      .set('Cookie', cookies);

    expect(res.status).toBe(201);
    expect(res.body.data[0].lessons[0].content).toContain('Content generation failed');
    expect(res.body.data[0].lessons[1].content).toContain('Content generation failed');
  });

  it('falls back to a placeholder for a module whose content call throws (e.g. a rate limit), without failing the whole generation', async () => {
    const course = await createCourse();
    const admin = await createTeacherUser({ email: 'x@example.com' });
    const document = await createReadyDocument(course.id, admin.id);
    const cookies = await signInAs('admin@example.com', 'admin');

    // Real incident (2026-08-25): a module hitting a Groq rate limit deep
    // into a multi-module generation used to throw away the whole request —
    // including every module already generated before it — instead of
    // degrading to a placeholder for just this one module.
    vi.mocked(generateJson)
      .mockResolvedValueOnce(validSkeletonJson)
      .mockRejectedValueOnce(
        new Error('The AI service has reached its per-minute usage limit — please try again in a minute or two.'),
      );

    const res = await request(app)
      .post(`/api/v1/courses/${course.id}/documents/${document.id}/generate`)
      .set('Cookie', cookies);

    expect(res.status).toBe(201);
    expect(res.body.data[0].lessons[0].content).toContain('Content generation failed');
    expect(res.body.data[0].lessons[1].content).toContain('Content generation failed');
  });

  it('falls back to a placeholder for just the lesson a module response omits', async () => {
    const course = await createCourse();
    const admin = await createTeacherUser({ email: 'x@example.com' });
    const document = await createReadyDocument(course.id, admin.id);
    const cookies = await signInAs('admin@example.com', 'admin');

    vi.mocked(generateJson)
      .mockResolvedValueOnce(validSkeletonJson)
      .mockResolvedValueOnce(
        moduleContentJson([
          { title: 'Light-dependent reactions', content: 'Plants convert light energy into chemical energy.' },
          // "Calvin cycle" omitted — the model didn't cover every lesson it was asked for.
        ]),
      );

    const res = await request(app)
      .post(`/api/v1/courses/${course.id}/documents/${document.id}/generate`)
      .set('Cookie', cookies);

    expect(res.status).toBe(201);
    expect(res.body.data[0].lessons[0].content).toBe('Plants convert light energy into chemical energy.');
    expect(res.body.data[0].lessons[1].content).toContain('Content generation failed');
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
