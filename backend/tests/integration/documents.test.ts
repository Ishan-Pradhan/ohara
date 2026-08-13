import path from 'node:path';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import request from 'supertest';

vi.mock('../../src/services/email.service.js', async () => {
  const { emailServiceStub } = await import('../helpers/auth.js');
  return emailServiceStub();
});

const { app } = await import('../../src/app.js');
const { truncateAll, closeDb } = await import('../helpers/db.js');
const { cookiesFrom } = await import('../helpers/auth.js');
const { User } = await import('../../src/models/users.model.js');
const { Document } = await import('../../src/models/documents.model.js');
const { DocumentChunk } = await import('../../src/models/documentChunks.model.js');
const { createCourse, createTeacherUser, createEnrollment } = await import(
  '../helpers/institution.js'
);
const { courseTeacherRepository } = await import(
  '../../src/repositories/courseTeachers.repository.js'
);
const { documentRepository } = await import('../../src/repositories/documents.repository.js');
const { courseRepository } = await import('../../src/repositories/courses.repository.js');
const { ensureDocumentsDir, documentFilePath } = await import('../../src/utils/storage.utils.js');
const { EMBEDDING_DIMENSIONS } = await import('../../src/constants/index.js');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SAMPLE_PDF = path.join(__dirname, '..', 'fixtures', 'sample.pdf');
const CORRUPT_PDF = path.join(__dirname, '..', 'fixtures', 'corrupt.pdf');

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
 * user row, to an active enrollment in the given course. Mirrors
 * tests/integration/tutor.test.ts's helper of the same shape. */
const signInEnrolledStudent = async (email: string, courseId: string): Promise<string[]> => {
  const cookies = await signInAs(email, 'student');
  const user = await User.findOne({ where: { email } });
  await createEnrollment({ studentId: user!.id, courseId });
  return cookies;
};

const waitForStatus = async (
  documentId: string,
  expected: 'ready' | 'failed',
  timeoutMs = 20000,
) => {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const doc = await Document.findByPk(documentId);
    if (doc?.status === expected) return doc;
    if (doc?.status === 'failed' && expected !== 'failed') {
      throw new Error(`Document unexpectedly failed: ${doc.errorMessage}`);
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`Timed out waiting for document ${documentId} to become "${expected}"`);
};

beforeEach(async () => {
  await truncateAll();
});

afterAll(async () => {
  await closeDb();
});

describe('POST /courses/:courseId/documents', () => {
  it('rejects an unauthenticated caller with 401', async () => {
    const course = await createCourse();
    const res = await request(app)
      .post(`/api/v1/courses/${course.id}/documents`)
      .attach('file', SAMPLE_PDF);
    expect(res.status).toBe(401);
  });

  it('rejects a teacher not assigned to the course with 403', async () => {
    const course = await createCourse();
    const cookies = await signInAs('outsider-teacher@example.com', 'teacher');
    const res = await request(app)
      .post(`/api/v1/courses/${course.id}/documents`)
      .set('Cookie', cookies)
      .attach('file', SAMPLE_PDF);
    expect(res.status).toBe(403);
  });

  it('rejects a student with 403', async () => {
    const course = await createCourse();
    const cookies = await signInAs('student@example.com', 'student');
    const res = await request(app)
      .post(`/api/v1/courses/${course.id}/documents`)
      .set('Cookie', cookies)
      .attach('file', SAMPLE_PDF);
    expect(res.status).toBe(403);
  });

  it('rejects a non-PDF file with 400', async () => {
    const course = await createCourse();
    const cookies = await signInAs('admin@example.com', 'admin');
    const res = await request(app)
      .post(`/api/v1/courses/${course.id}/documents`)
      .set('Cookie', cookies)
      .attach('file', Buffer.from('not a pdf'), { filename: 'notes.txt', contentType: 'text/plain' });
    expect(res.status).toBe(400);
  });

  it('accepts an upload from an assigned teacher and returns 202 with status processing', async () => {
    const course = await createCourse();
    const teacher = await createTeacherUser({ email: 'owner-teacher@example.com' });
    await courseTeacherRepository.assign({ teacherId: teacher.id, courseId: course.id });
    const cookies = await signInAs(teacher.email, 'teacher');

    const res = await request(app)
      .post(`/api/v1/courses/${course.id}/documents`)
      .set('Cookie', cookies)
      .attach('file', SAMPLE_PDF);

    expect(res.status).toBe(202);
    expect(res.body.data).toMatchObject({
      courseId: course.id,
      status: 'processing',
      filename: 'sample.pdf',
    });
    expect(res.body.data).not.toHaveProperty('storageKey');
  });

  it(
    'processes the PDF in the background into ready chunks with embeddings',
    async () => {
      const course = await createCourse();
      const cookies = await signInAs('admin@example.com', 'admin');

      const res = await request(app)
        .post(`/api/v1/courses/${course.id}/documents`)
        .set('Cookie', cookies)
        .attach('file', SAMPLE_PDF);

      const ready = await waitForStatus(res.body.data.id, 'ready');
      expect(ready.status).toBe('ready');

      const chunks = await DocumentChunk.findAll({ where: { documentId: ready.id } });
      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks[0]?.content).toContain('photosynthesis');
      expect(chunks[0]?.embedding).toHaveLength(EMBEDDING_DIMENSIONS);
    },
    30000,
  );

  it(
    'marks the document failed when the PDF cannot be parsed',
    async () => {
      const course = await createCourse();
      const cookies = await signInAs('admin@example.com', 'admin');

      const res = await request(app)
        .post(`/api/v1/courses/${course.id}/documents`)
        .set('Cookie', cookies)
        .attach('file', CORRUPT_PDF, { filename: 'corrupt.pdf', contentType: 'application/pdf' });

      const failed = await waitForStatus(res.body.data.id, 'failed');
      expect(failed.status).toBe('failed');
      expect(failed.errorMessage).toBeTruthy();
    },
    30000,
  );
});

describe('GET /courses/:courseId/documents', () => {
  it('lists documents for admins and assigned teachers, rejects everyone else', async () => {
    const course = await createCourse();
    const teacher = await createTeacherUser({ email: 'lister-teacher@example.com' });
    await courseTeacherRepository.assign({ teacherId: teacher.id, courseId: course.id });

    const adminCookies = await signInAs('admin@example.com', 'admin');
    await request(app)
      .post(`/api/v1/courses/${course.id}/documents`)
      .set('Cookie', adminCookies)
      .attach('file', SAMPLE_PDF);

    const teacherCookies = await signInAs(teacher.email, 'teacher');
    const asTeacher = await request(app)
      .get(`/api/v1/courses/${course.id}/documents`)
      .set('Cookie', teacherCookies);
    expect(asTeacher.status).toBe(200);
    expect(asTeacher.body.data).toHaveLength(1);

    const studentCookies = await signInAs('student@example.com', 'student');
    const asStudent = await request(app)
      .get(`/api/v1/courses/${course.id}/documents`)
      .set('Cookie', studentCookies);
    expect(asStudent.status).toBe(403);
  });
});

describe('DELETE /courses/:courseId/documents/:id', () => {
  it('deletes the row and the file from disk', async () => {
    const course = await createCourse();
    const cookies = await signInAs('admin@example.com', 'admin');

    const uploadRes = await request(app)
      .post(`/api/v1/courses/${course.id}/documents`)
      .set('Cookie', cookies)
      .attach('file', SAMPLE_PDF);

    const documentId = uploadRes.body.data.id;
    const created = await Document.findByPk(documentId);
    const storageKey = created?.storageKey as string;

    const deleteRes = await request(app)
      .delete(`/api/v1/courses/${course.id}/documents/${documentId}`)
      .set('Cookie', cookies);

    expect(deleteRes.status).toBe(200);
    expect(await Document.findByPk(documentId)).toBeNull();
    await expect(fs.access(storageKey)).rejects.toThrow();
  });

  it("404s deleting a document that belongs to a different course", async () => {
    const courseA = await createCourse();
    const courseB = await createCourse();
    const cookies = await signInAs('admin@example.com', 'admin');

    const uploadRes = await request(app)
      .post(`/api/v1/courses/${courseA.id}/documents`)
      .set('Cookie', cookies)
      .attach('file', SAMPLE_PDF);

    const res = await request(app)
      .delete(`/api/v1/courses/${courseB.id}/documents/${uploadRes.body.data.id}`)
      .set('Cookie', cookies);

    expect(res.status).toBe(404);
  });
});

describe('PATCH /courses/:courseId/knowledge-base', () => {
  it('selects a ready document as the course knowledge base', async () => {
    const course = await createCourse();
    const teacher = await createTeacherUser();
    const document = await documentRepository.create({
      courseId: course.id,
      uploadedBy: teacher.id,
      filename: 'textbook.pdf',
      storageKey: '/tmp/textbook.pdf',
      status: 'ready',
    });
    const cookies = await signInAs('admin@example.com', 'admin');

    const res = await request(app)
      .patch(`/api/v1/courses/${course.id}/knowledge-base`)
      .set('Cookie', cookies)
      .send({ documentId: document.id });

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ id: course.id, knowledgeBaseDocumentId: document.id });

    const updated = await courseRepository.findById(course.id);
    expect(updated?.knowledgeBaseDocumentId).toBe(document.id);
  });

  it('clears the selection when documentId is null', async () => {
    const course = await createCourse();
    const teacher = await createTeacherUser();
    const document = await documentRepository.create({
      courseId: course.id,
      uploadedBy: teacher.id,
      filename: 'textbook.pdf',
      storageKey: '/tmp/textbook.pdf',
      status: 'ready',
    });
    await courseRepository.setKnowledgeBaseDocument(course.id, document.id);
    const cookies = await signInAs('admin@example.com', 'admin');

    const res = await request(app)
      .patch(`/api/v1/courses/${course.id}/knowledge-base`)
      .set('Cookie', cookies)
      .send({ documentId: null });

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ id: course.id, knowledgeBaseDocumentId: null });

    const updated = await courseRepository.findById(course.id);
    expect(updated?.knowledgeBaseDocumentId).toBeNull();
  });

  it('rejects a document that has not finished processing yet', async () => {
    const course = await createCourse();
    const teacher = await createTeacherUser();
    const processingDocument = await documentRepository.create({
      courseId: course.id,
      uploadedBy: teacher.id,
      filename: 'still-processing.pdf',
      storageKey: '/tmp/still-processing.pdf',
      status: 'processing',
    });
    const cookies = await signInAs('admin@example.com', 'admin');

    const res = await request(app)
      .patch(`/api/v1/courses/${course.id}/knowledge-base`)
      .set('Cookie', cookies)
      .send({ documentId: processingDocument.id });

    expect(res.status).toBe(400);
    const updated = await courseRepository.findById(course.id);
    expect(updated?.knowledgeBaseDocumentId).toBeNull();
  });

  it("404s selecting a document that belongs to a different course", async () => {
    const courseA = await createCourse();
    const courseB = await createCourse();
    const teacher = await createTeacherUser();
    const documentInB = await documentRepository.create({
      courseId: courseB.id,
      uploadedBy: teacher.id,
      filename: 'textbook.pdf',
      storageKey: '/tmp/textbook.pdf',
      status: 'ready',
    });
    const cookies = await signInAs('admin@example.com', 'admin');

    const res = await request(app)
      .patch(`/api/v1/courses/${courseA.id}/knowledge-base`)
      .set('Cookie', cookies)
      .send({ documentId: documentInB.id });

    expect(res.status).toBe(404);
  });
});

describe('GET /courses/:courseId/documents/:id/file', () => {
  /** Creates a document row backed by a real file on disk (a copy of the
   * sample fixture) — res.sendFile needs an actual file to stream, unlike
   * the knowledge-base tests above which never touch the file itself. */
  const createDocumentWithRealFile = async (courseId: string, uploaderId: string) => {
    const document = await documentRepository.create({
      courseId,
      uploadedBy: uploaderId,
      filename: 'lecture-1.pdf',
      storageKey: '',
    });
    await ensureDocumentsDir();
    const filePath = documentFilePath(document.id);
    await fs.copyFile(SAMPLE_PDF, filePath);
    await document.update({ storageKey: filePath, status: 'ready' });
    return document;
  };

  it('streams the PDF inline for an assigned teacher', async () => {
    const course = await createCourse();
    const teacher = await createTeacherUser();
    await courseTeacherRepository.assign({ teacherId: teacher.id, courseId: course.id });
    const document = await createDocumentWithRealFile(course.id, teacher.id);
    const cookies = await signInAs(teacher.email, 'teacher');

    const res = await request(app)
      .get(`/api/v1/courses/${course.id}/documents/${document.id}/file`)
      .set('Cookie', cookies);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('application/pdf');
    expect(res.headers['content-disposition']).toContain('inline');
    expect(res.headers['content-disposition']).toContain('lecture-1.pdf');
  });

  it('streams the PDF for an enrolled student', async () => {
    const course = await createCourse();
    const teacher = await createTeacherUser();
    const document = await createDocumentWithRealFile(course.id, teacher.id);
    const studentCookies = await signInEnrolledStudent('viewer@example.com', course.id);

    const res = await request(app)
      .get(`/api/v1/courses/${course.id}/documents/${document.id}/file`)
      .set('Cookie', studentCookies);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('application/pdf');
  });

  it('403s a student who is not enrolled in this course', async () => {
    const course = await createCourse();
    const teacher = await createTeacherUser();
    const document = await createDocumentWithRealFile(course.id, teacher.id);
    const outsiderCookies = await signInAs('outsider@example.com', 'student');

    const res = await request(app)
      .get(`/api/v1/courses/${course.id}/documents/${document.id}/file`)
      .set('Cookie', outsiderCookies);

    expect(res.status).toBe(403);
  });

  it("404s a document belonging to a different course", async () => {
    const courseA = await createCourse();
    const courseB = await createCourse();
    const teacher = await createTeacherUser();
    await courseTeacherRepository.assign({ teacherId: teacher.id, courseId: courseA.id });
    await courseTeacherRepository.assign({ teacherId: teacher.id, courseId: courseB.id });
    const documentInB = await createDocumentWithRealFile(courseB.id, teacher.id);
    const cookies = await signInAs(teacher.email, 'teacher');

    const res = await request(app)
      .get(`/api/v1/courses/${courseA.id}/documents/${documentInB.id}/file`)
      .set('Cookie', cookies);

    expect(res.status).toBe(404);
  });
});

describe('GET /courses/:courseId/documents/viewable', () => {
  it("404s when the course isn't published yet", async () => {
    const course = await createCourse();
    const studentCookies = await signInEnrolledStudent('student@example.com', course.id);

    const res = await request(app)
      .get(`/api/v1/courses/${course.id}/documents/viewable`)
      .set('Cookie', studentCookies);

    expect(res.status).toBe(404);
  });

  it('returns only ready documents once the course is published', async () => {
    const course = await createCourse();
    await courseRepository.setPublished(course.id, true);
    const teacher = await createTeacherUser();

    const ready = await documentRepository.create({
      courseId: course.id,
      uploadedBy: teacher.id,
      filename: 'ready.pdf',
      storageKey: '/tmp/ready.pdf',
      status: 'ready',
    });
    await documentRepository.create({
      courseId: course.id,
      uploadedBy: teacher.id,
      filename: 'still-processing.pdf',
      storageKey: '/tmp/still-processing.pdf',
      status: 'processing',
    });
    await documentRepository.create({
      courseId: course.id,
      uploadedBy: teacher.id,
      filename: 'failed.pdf',
      storageKey: '/tmp/failed.pdf',
      status: 'failed',
    });

    const studentCookies = await signInEnrolledStudent('student@example.com', course.id);

    const res = await request(app)
      .get(`/api/v1/courses/${course.id}/documents/viewable`)
      .set('Cookie', studentCookies);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0]).toMatchObject({ id: ready.id, filename: 'ready.pdf', status: 'ready' });
  });

  it('403s a teacher — this endpoint is student-only', async () => {
    const course = await createCourse();
    await courseRepository.setPublished(course.id, true);
    const teacher = await createTeacherUser();
    await courseTeacherRepository.assign({ teacherId: teacher.id, courseId: course.id });
    const cookies = await signInAs(teacher.email, 'teacher');

    const res = await request(app)
      .get(`/api/v1/courses/${course.id}/documents/viewable`)
      .set('Cookie', cookies);

    expect(res.status).toBe(403);
  });
});

describe('PATCH /courses/:courseId/syllabus', () => {
  it('selects a ready document as the course syllabus', async () => {
    const course = await createCourse();
    const teacher = await createTeacherUser();
    const document = await documentRepository.create({
      courseId: course.id,
      uploadedBy: teacher.id,
      filename: 'official-syllabus.pdf',
      storageKey: '/tmp/official-syllabus.pdf',
      status: 'ready',
    });
    const cookies = await signInAs('admin@example.com', 'admin');

    const res = await request(app)
      .patch(`/api/v1/courses/${course.id}/syllabus`)
      .set('Cookie', cookies)
      .send({ documentId: document.id });

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ id: course.id, syllabusDocumentId: document.id });

    const updated = await courseRepository.findById(course.id);
    expect(updated?.syllabusDocumentId).toBe(document.id);
  });

  it('is independent of the knowledge base selection — both can be set to different documents', async () => {
    const course = await createCourse();
    const teacher = await createTeacherUser();
    const syllabusDoc = await documentRepository.create({
      courseId: course.id,
      uploadedBy: teacher.id,
      filename: 'official-syllabus.pdf',
      storageKey: '/tmp/official-syllabus.pdf',
      status: 'ready',
    });
    const textbookDoc = await documentRepository.create({
      courseId: course.id,
      uploadedBy: teacher.id,
      filename: 'textbook.pdf',
      storageKey: '/tmp/textbook.pdf',
      status: 'ready',
    });
    const cookies = await signInAs('admin@example.com', 'admin');

    await request(app)
      .patch(`/api/v1/courses/${course.id}/syllabus`)
      .set('Cookie', cookies)
      .send({ documentId: syllabusDoc.id });
    await request(app)
      .patch(`/api/v1/courses/${course.id}/knowledge-base`)
      .set('Cookie', cookies)
      .send({ documentId: textbookDoc.id });

    const updated = await courseRepository.findById(course.id);
    expect(updated?.syllabusDocumentId).toBe(syllabusDoc.id);
    expect(updated?.knowledgeBaseDocumentId).toBe(textbookDoc.id);
  });

  it('clears the selection when documentId is null', async () => {
    const course = await createCourse();
    const teacher = await createTeacherUser();
    const document = await documentRepository.create({
      courseId: course.id,
      uploadedBy: teacher.id,
      filename: 'official-syllabus.pdf',
      storageKey: '/tmp/official-syllabus.pdf',
      status: 'ready',
    });
    await courseRepository.setSyllabusDocument(course.id, document.id);
    const cookies = await signInAs('admin@example.com', 'admin');

    const res = await request(app)
      .patch(`/api/v1/courses/${course.id}/syllabus`)
      .set('Cookie', cookies)
      .send({ documentId: null });

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ id: course.id, syllabusDocumentId: null });

    const updated = await courseRepository.findById(course.id);
    expect(updated?.syllabusDocumentId).toBeNull();
  });

  it('rejects a document that has not finished processing yet', async () => {
    const course = await createCourse();
    const teacher = await createTeacherUser();
    const processingDocument = await documentRepository.create({
      courseId: course.id,
      uploadedBy: teacher.id,
      filename: 'still-processing.pdf',
      storageKey: '/tmp/still-processing.pdf',
      status: 'processing',
    });
    const cookies = await signInAs('admin@example.com', 'admin');

    const res = await request(app)
      .patch(`/api/v1/courses/${course.id}/syllabus`)
      .set('Cookie', cookies)
      .send({ documentId: processingDocument.id });

    expect(res.status).toBe(400);
    const updated = await courseRepository.findById(course.id);
    expect(updated?.syllabusDocumentId).toBeNull();
  });

  it("404s selecting a document that belongs to a different course", async () => {
    const courseA = await createCourse();
    const courseB = await createCourse();
    const teacher = await createTeacherUser();
    const documentInB = await documentRepository.create({
      courseId: courseB.id,
      uploadedBy: teacher.id,
      filename: 'official-syllabus.pdf',
      storageKey: '/tmp/official-syllabus.pdf',
      status: 'ready',
    });
    const cookies = await signInAs('admin@example.com', 'admin');

    const res = await request(app)
      .patch(`/api/v1/courses/${courseA.id}/syllabus`)
      .set('Cookie', cookies)
      .send({ documentId: documentInB.id });

    expect(res.status).toBe(404);
  });
});
