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

vi.mock('../../src/services/embeddings.service.js', () => ({
  embed: vi.fn(),
}));

const { app } = await import('../../src/app.js');
const { truncateAll, closeDb } = await import('../helpers/db.js');
const { cookiesFrom } = await import('../helpers/auth.js');
const { User } = await import('../../src/models/users.model.js');
const { createCourse, createTeacherUser, createEnrollment } = await import('../helpers/institution.js');
const { documentRepository } = await import('../../src/repositories/documents.repository.js');
const { documentChunkRepository } = await import(
  '../../src/repositories/documentChunks.repository.js'
);
const { courseRepository } = await import('../../src/repositories/courses.repository.js');
const { moduleRepository } = await import('../../src/repositories/modules.repository.js');
const { lessonRepository } = await import('../../src/repositories/lessons.repository.js');
const { EMBEDDING_DIMENSIONS } = await import('../../src/constants/index.js');
const { generateJson, generateText } = await import('../../src/services/llm.service.js');
const { embed } = await import('../../src/services/embeddings.service.js');

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

const signInEnrolledStudent = async (email: string, courseId: string): Promise<string[]> => {
  const cookies = await signInAs(email, 'student');
  const user = await User.findOne({ where: { email } });
  await createEnrollment({ studentId: user!.id, courseId });
  return cookies;
};

const vector = (value: number): number[] => new Array(EMBEDDING_DIMENSIONS).fill(value) as number[];
const orthogonalVector = (): number[] => {
  const v = new Array(EMBEDDING_DIMENSIONS).fill(0) as number[];
  v[0] = 1;
  return v;
};

/** Seeds a course with a lesson (for lesson-scoped generation) and a ready
 * knowledge-base document with one chunk (for course-wide fallback /
 * explain grounding). */
const seedCourseWithLessonAndMaterial = async () => {
  const course = await createCourse();
  const teacher = await createTeacherUser();
  const module = await moduleRepository.create({ courseId: course.id, title: 'Module 1', orderIndex: 0 });
  const lesson = await lessonRepository.create({
    moduleId: module.id,
    title: 'Photosynthesis',
    content: 'Photosynthesis converts light energy into chemical energy stored in glucose.',
    keyTopics: ['photosynthesis', 'chlorophyll'],
    orderIndex: 0,
  });
  const document = await documentRepository.create({
    courseId: course.id,
    uploadedBy: teacher.id,
    filename: 'bio.pdf',
    storageKey: '/tmp/bio.pdf',
    status: 'ready',
  });
  await documentChunkRepository.bulkCreate([
    { documentId: document.id, chunkIndex: 0, content: 'Photosynthesis converts light energy into chemical energy.', embedding: vector(0.1) },
  ]);
  await courseRepository.setKnowledgeBaseDocument(course.id, document.id);
  return { course, lesson };
};

beforeEach(async () => {
  await truncateAll();
  vi.mocked(generateJson).mockReset();
  vi.mocked(generateText).mockReset();
  vi.mocked(embed).mockReset();
  vi.mocked(embed).mockImplementation(async (texts: string[]) =>
    texts.map(() => vector(0.1)),
  );
});

afterAll(async () => {
  await closeDb();
});

describe('POST /courses/:courseId/study-aids/summary', () => {
  it('generates, persists, and reuses a cached lesson summary without calling the LLM twice', async () => {
    const { course, lesson } = await seedCourseWithLessonAndMaterial();
    const studentCookie = await signInEnrolledStudent('s1@example.com', course.id);

    vi.mocked(generateJson).mockResolvedValueOnce(
      JSON.stringify({ summary: 'A summary of photosynthesis.', keyPoints: ['Converts light to chemical energy'] }),
    );

    const first = await request(app)
      .post(`/api/v1/courses/${course.id}/study-aids/summary`)
      .set('Cookie', studentCookie)
      .send({ lessonId: lesson.id });

    expect(first.status).toBe(201);
    expect(first.body.data.content).toMatchObject({ summary: 'A summary of photosynthesis.' });
    expect(generateJson).toHaveBeenCalledTimes(1);

    const second = await request(app)
      .post(`/api/v1/courses/${course.id}/study-aids/summary`)
      .set('Cookie', studentCookie)
      .send({ lessonId: lesson.id });

    expect(second.status).toBe(200);
    expect(second.body.data.id).toBe(first.body.data.id);
    expect(generateJson).toHaveBeenCalledTimes(1); // still 1 — served from cache

    const getRes = await request(app)
      .get(`/api/v1/courses/${course.id}/study-aids/summary`)
      .query({ lessonId: lesson.id })
      .set('Cookie', studentCookie);
    expect(getRes.status).toBe(200);
    expect(getRes.body.data.id).toBe(first.body.data.id);
  });

  it('404s GET before anything has been generated', async () => {
    const { course, lesson } = await seedCourseWithLessonAndMaterial();
    const studentCookie = await signInEnrolledStudent('s2@example.com', course.id);
    const res = await request(app)
      .get(`/api/v1/courses/${course.id}/study-aids/summary`)
      .query({ lessonId: lesson.id })
      .set('Cookie', studentCookie);
    expect(res.status).toBe(404);
  });

  it('generates a course-wide summary from aggregated lesson content when no lessonId is given', async () => {
    const { course } = await seedCourseWithLessonAndMaterial();
    const studentCookie = await signInEnrolledStudent('s3@example.com', course.id);

    vi.mocked(generateJson).mockResolvedValueOnce(
      JSON.stringify({ summary: 'Course-wide summary.', keyPoints: ['Point 1'] }),
    );

    const res = await request(app)
      .post(`/api/v1/courses/${course.id}/study-aids/summary`)
      .set('Cookie', studentCookie)
      .send({});

    expect(res.status).toBe(201);
    expect(res.body.data.lessonId).toBeNull();
    expect(res.body.data.content.summary).toBe('Course-wide summary.');
  });

  it('400s when the course has neither lessons nor a knowledge-base document', async () => {
    const course = await createCourse();
    const studentCookie = await signInEnrolledStudent('s4@example.com', course.id);

    const res = await request(app)
      .post(`/api/v1/courses/${course.id}/study-aids/summary`)
      .set('Cookie', studentCookie)
      .send({});
    expect(res.status).toBe(400);
    expect(generateJson).not.toHaveBeenCalled();
  });

  it('rejects a non-enrolled student', async () => {
    const { course, lesson } = await seedCourseWithLessonAndMaterial();
    const outsiderCookie = await signInAs('outsider@example.com', 'student');
    const res = await request(app)
      .post(`/api/v1/courses/${course.id}/study-aids/summary`)
      .set('Cookie', outsiderCookie)
      .send({ lessonId: lesson.id });
    expect(res.status).toBe(403);
  });

  it('retries once on invalid JSON, then 502s if it is still invalid', async () => {
    const { course, lesson } = await seedCourseWithLessonAndMaterial();
    const studentCookie = await signInEnrolledStudent('s5@example.com', course.id);

    vi.mocked(generateJson).mockResolvedValueOnce('not json').mockResolvedValueOnce('still not json');
    const res = await request(app)
      .post(`/api/v1/courses/${course.id}/study-aids/summary`)
      .set('Cookie', studentCookie)
      .send({ lessonId: lesson.id });
    expect(res.status).toBe(502);
    expect(generateJson).toHaveBeenCalledTimes(2);
  });

  it('regenerate: true bypasses the cache and replaces the stored summary with fresh content', async () => {
    const { course, lesson } = await seedCourseWithLessonAndMaterial();
    const studentCookie = await signInEnrolledStudent('s6@example.com', course.id);

    vi.mocked(generateJson).mockResolvedValueOnce(
      JSON.stringify({ summary: 'First version.', keyPoints: ['A'] }),
    );
    const first = await request(app)
      .post(`/api/v1/courses/${course.id}/study-aids/summary`)
      .set('Cookie', studentCookie)
      .send({ lessonId: lesson.id });
    expect(first.status).toBe(201);

    vi.mocked(generateJson).mockResolvedValueOnce(
      JSON.stringify({ summary: 'Regenerated version.', keyPoints: ['B'] }),
    );
    const regenerated = await request(app)
      .post(`/api/v1/courses/${course.id}/study-aids/summary`)
      .set('Cookie', studentCookie)
      .send({ lessonId: lesson.id, regenerate: true });

    expect(regenerated.status).toBe(201);
    expect(regenerated.body.data.content.summary).toBe('Regenerated version.');
    expect(generateJson).toHaveBeenCalledTimes(2); // called again, not served from cache

    const getRes = await request(app)
      .get(`/api/v1/courses/${course.id}/study-aids/summary`)
      .query({ lessonId: lesson.id })
      .set('Cookie', studentCookie);
    expect(getRes.body.data.content.summary).toBe('Regenerated version.');
  });
});

describe('POST /courses/:courseId/study-aids/flashcards', () => {
  it('generates and caches a lesson flashcard set', async () => {
    const { course, lesson } = await seedCourseWithLessonAndMaterial();
    const studentCookie = await signInEnrolledStudent('f1@example.com', course.id);

    vi.mocked(generateJson).mockResolvedValueOnce(
      JSON.stringify({ cards: [{ front: 'What is photosynthesis?', back: 'Converting light to chemical energy.' }] }),
    );

    const res = await request(app)
      .post(`/api/v1/courses/${course.id}/study-aids/flashcards`)
      .set('Cookie', studentCookie)
      .send({ lessonId: lesson.id });

    expect(res.status).toBe(201);
    expect(res.body.data.content.cards).toHaveLength(1);
    expect(res.body.data.type).toBe('flashcards');
  });

  it('regenerate: true bypasses the cache and replaces the stored flashcard set', async () => {
    const { course, lesson } = await seedCourseWithLessonAndMaterial();
    const studentCookie = await signInEnrolledStudent('f2@example.com', course.id);

    vi.mocked(generateJson).mockResolvedValueOnce(
      JSON.stringify({ cards: [{ front: 'Q1', back: 'A1' }] }),
    );
    const first = await request(app)
      .post(`/api/v1/courses/${course.id}/study-aids/flashcards`)
      .set('Cookie', studentCookie)
      .send({ lessonId: lesson.id });
    expect(first.status).toBe(201);

    vi.mocked(generateJson).mockResolvedValueOnce(
      JSON.stringify({ cards: [{ front: 'Q2', back: 'A2' }, { front: 'Q3', back: 'A3' }] }),
    );
    const regenerated = await request(app)
      .post(`/api/v1/courses/${course.id}/study-aids/flashcards`)
      .set('Cookie', studentCookie)
      .send({ lessonId: lesson.id, regenerate: true });

    expect(regenerated.status).toBe(201);
    expect(regenerated.body.data.content.cards).toHaveLength(2);
    expect(generateJson).toHaveBeenCalledTimes(2); // called again, not served from cache
  });
});

describe('POST /courses/:courseId/study-aids/explain', () => {
  it('explains a lesson-scoped concept using the lesson content directly (no embed call)', async () => {
    const { course, lesson } = await seedCourseWithLessonAndMaterial();
    const studentCookie = await signInEnrolledStudent('e1@example.com', course.id);

    vi.mocked(generateText).mockResolvedValueOnce('A detailed explanation of photosynthesis...');

    const res = await request(app)
      .post(`/api/v1/courses/${course.id}/study-aids/explain`)
      .set('Cookie', studentCookie)
      .send({ lessonId: lesson.id, topic: 'photosynthesis' });

    expect(res.status).toBe(200);
    expect(res.body.data.explanation).toBe('A detailed explanation of photosynthesis...');
    expect(embed).not.toHaveBeenCalled();
  });

  it('refuses a course-wide off-topic concept without ever calling the LLM', async () => {
    const { course } = await seedCourseWithLessonAndMaterial();
    const studentCookie = await signInEnrolledStudent('e2@example.com', course.id);

    // The stored chunk embeds near vector(0.1) (default mock); make this
    // query embed in an unrelated direction, mirroring the tutor's own
    // relevance-threshold regression test.
    vi.mocked(embed).mockImplementation(async (texts: string[]) => texts.map(() => orthogonalVector()));

    const res = await request(app)
      .post(`/api/v1/courses/${course.id}/study-aids/explain`)
      .set('Cookie', studentCookie)
      .send({ topic: 'something entirely unrelated' });

    expect(res.status).toBe(200);
    expect(res.body.data.explanation).toBe("The material doesn't cover this topic.");
    expect(generateText).not.toHaveBeenCalled();
  });

  it('explains a course-wide on-topic concept grounded in the knowledge-base document', async () => {
    const { course } = await seedCourseWithLessonAndMaterial();
    const studentCookie = await signInEnrolledStudent('e3@example.com', course.id);

    vi.mocked(generateText).mockResolvedValueOnce('Explanation grounded in the document.');

    const res = await request(app)
      .post(`/api/v1/courses/${course.id}/study-aids/explain`)
      .set('Cookie', studentCookie)
      .send({ topic: 'photosynthesis' });

    expect(res.status).toBe(200);
    expect(res.body.data.explanation).toBe('Explanation grounded in the document.');
  });
});
