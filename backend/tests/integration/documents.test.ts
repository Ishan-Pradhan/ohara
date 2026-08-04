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
const { createCourse, createTeacherUser } = await import('../helpers/institution.js');
const { courseTeacherRepository } = await import(
  '../../src/repositories/courseTeachers.repository.js'
);
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
