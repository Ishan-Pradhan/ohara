import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';

vi.mock('../../src/services/email.service.js', async () => {
  const { emailServiceStub } = await import('../helpers/auth.js');
  return emailServiceStub();
});

const { truncateAll, closeDb } = await import('../helpers/db.js');
const { createCourse, createTeacherUser, createStudentUser, createEnrollment } = await import(
  '../helpers/institution.js'
);
const { documentRepository } = await import('../../src/repositories/documents.repository.js');
const { documentChunkRepository } = await import(
  '../../src/repositories/documentChunks.repository.js'
);
const { enrollmentRepository } = await import('../../src/repositories/enrollments.repository.js');
const { EMBEDDING_DIMENSIONS } = await import('../../src/constants/index.js');

beforeEach(async () => {
  await truncateAll();
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
