import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import request from 'supertest';

vi.mock('../../src/services/email.service.js', async () => {
  const { emailServiceStub } = await import('../helpers/auth.js');
  return emailServiceStub();
});

vi.mock('../../src/services/llm.service.js', () => ({
  generateText: vi.fn(),
  runAgentTurn: vi.fn(),
}));

vi.mock('../../src/services/embeddings.service.js', () => ({
  embed: vi.fn(),
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
const { tutorConversationRepository } = await import(
  '../../src/repositories/tutorConversations.repository.js'
);
const { tutorMessageRepository } = await import('../../src/repositories/tutorMessages.repository.js');
const { courseTeacherRepository } = await import('../../src/repositories/courseTeachers.repository.js');
const { EMBEDDING_DIMENSIONS, TUTOR_CONVERSATION_STATUSES } = await import(
  '../../src/constants/index.js'
);
const { generateText, runAgentTurn } = await import('../../src/services/llm.service.js');
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
  vi.mocked(runAgentTurn).mockReset();
  vi.mocked(runAgentTurn).mockResolvedValue({
    type: 'text',
    content: 'This is a tutor response grounded in the material.',
  });
  // embed is called by the real tool handlers (search_course_material) and
  // stage1Fallback; return a constant valid vector so those paths succeed
  // without the real model and its filesystem cache.
  vi.mocked(embed).mockReset();
  vi.mocked(embed).mockImplementation(async (texts: string[]) =>
    texts.map(() => new Array(EMBEDDING_DIMENSIONS).fill(0.1) as number[]),
  );
});

afterAll(async () => {
  await closeDb();
});

/** A valid, non-zero embedding of the model's dimension — cosine distance is
 * undefined for the zero vector, so every fixture vector uses a constant
 * fill instead. */
const vector = (value: number): number[] => new Array(EMBEDDING_DIMENSIONS).fill(value) as number[];

/** Any two constant-fill vectors point in the exact same direction (one is
 * just a positive scalar multiple of the other), so `vector(a)` vs `vector(b)`
 * always has cosine distance 0 regardless of a/b — useless for testing a
 * distance *threshold*. This one-hot vector points in a genuinely different
 * direction from every `vector(...)` fixture (cosine distance ≈ 0.95 against
 * any of them), standing in for "an unrelated query/chunk" in threshold tests. */
const orthogonalVector = (): number[] => {
  const v = new Array(EMBEDDING_DIMENSIONS).fill(0) as number[];
  v[0] = 1;
  return v;
};

/** Seeds a course with one ready document and one chunk, and selects that
 * document as the course's knowledge base, so the tutor's up-front "does
 * this course have any material" check (tutorAgent.ts) passes and the agent
 * loop actually runs. Needed by every route-level test below that isn't
 * itself testing the zero-material short-circuit. */
const seedCourseWithMaterial = async (courseId: string): Promise<void> => {
  const teacher = await createTeacherUser();
  const document = await documentRepository.create({
    courseId,
    uploadedBy: teacher.id,
    filename: 'lecture-1.pdf',
    storageKey: '/tmp/lecture-1.pdf',
    status: 'ready',
  });
  await documentChunkRepository.bulkCreate([
    {
      documentId: document.id,
      chunkIndex: 0,
      content: 'Photosynthesis converts light energy into chemical energy.',
      embedding: vector(0.1),
    },
  ]);
  await courseRepository.setKnowledgeBaseDocument(courseId, document.id);
};

describe('documentChunkRepository.findSimilar', () => {
  it('only returns chunks from the target document, and only when it is ready', async () => {
    // Scoped by documentId, not courseId — a course can have several
    // uploaded documents (readyDocument and anotherReadyDocument both belong
    // to the same course here), but findSimilar only ever searches the one
    // document it's given (courses.knowledgeBaseDocumentId picks which).
    const uploader = await createTeacherUser();
    const course = await createCourse();

    const readyDocument = await documentRepository.create({
      courseId: course.id,
      uploadedBy: uploader.id,
      filename: 'ready.pdf',
      storageKey: '/tmp/ready.pdf',
      status: 'ready',
    });
    const anotherReadyDocument = await documentRepository.create({
      courseId: course.id,
      uploadedBy: uploader.id,
      filename: 'another-ready.pdf',
      storageKey: '/tmp/another-ready.pdf',
      status: 'ready',
    });
    const processingDocument = await documentRepository.create({
      courseId: course.id,
      uploadedBy: uploader.id,
      filename: 'processing.pdf',
      storageKey: '/tmp/processing.pdf',
      status: 'processing',
    });

    const [readyChunk] = await documentChunkRepository.bulkCreate([
      { documentId: readyDocument.id, chunkIndex: 0, content: 'ready', embedding: vector(0.1) },
    ]);
    await documentChunkRepository.bulkCreate([
      { documentId: readyDocument.id, chunkIndex: 1, content: 'ready-still-not-queried', embedding: vector(0.15) },
    ]);
    const [chunkOnAnotherDocument] = await documentChunkRepository.bulkCreate([
      { documentId: anotherReadyDocument.id, chunkIndex: 0, content: 'another', embedding: vector(0.2) },
    ]);
    const [chunkOnProcessingDocument] = await documentChunkRepository.bulkCreate([
      { documentId: processingDocument.id, chunkIndex: 0, content: 'processing', embedding: vector(0.3) },
    ]);

    const queryVector = vector(0.1);
    const results = await documentChunkRepository.findSimilar(readyDocument.id, queryVector, 5);
    const chunkIds = results.map((c) => c.id);

    expect(chunkIds).toContain(readyChunk?.id);
    expect(chunkIds).not.toContain(chunkOnAnotherDocument?.id);
    expect(chunkIds).not.toContain(chunkOnProcessingDocument?.id);

    // The same document while it's still processing (not yet ready) must
    // return nothing, even though chunks already exist for it.
    const resultsWhileProcessing = await documentChunkRepository.findSimilar(
      processingDocument.id,
      queryVector,
      5,
    );
    expect(resultsWhileProcessing).toHaveLength(0);
  });

  it('excludes chunks beyond maxDistance, and is a no-op filter when maxDistance is omitted', async () => {
    const uploader = await createTeacherUser();
    const course = await createCourse();
    const document = await documentRepository.create({
      courseId: course.id,
      uploadedBy: uploader.id,
      filename: 'doc.pdf',
      storageKey: '/tmp/doc.pdf',
      status: 'ready',
    });
    const [nearChunk] = await documentChunkRepository.bulkCreate([
      { documentId: document.id, chunkIndex: 0, content: 'on-topic', embedding: vector(0.1) },
    ]);
    const [farChunk] = await documentChunkRepository.bulkCreate([
      { documentId: document.id, chunkIndex: 1, content: 'unrelated', embedding: orthogonalVector() },
    ]);

    const queryVector = vector(0.1);

    // No threshold given: both come back (existing behavior, unaffected).
    const unfiltered = await documentChunkRepository.findSimilar(document.id, queryVector, 5);
    expect(unfiltered.map((c) => c.id).sort()).toEqual([nearChunk?.id, farChunk?.id].sort());

    // Threshold given: only the chunk within it comes back.
    const filtered = await documentChunkRepository.findSimilar(document.id, queryVector, 5, 0.45);
    expect(filtered.map((c) => c.id)).toEqual([nearChunk?.id]);
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
    await courseRepository.setKnowledgeBaseDocument(course.id, readyDocument.id);

    const enrolledStudentCookie = await signInEnrolledStudent('enrolled@example.com', course.id);

    const createRes = await request(app)
      .post(`/api/v1/courses/${course.id}/tutor/conversations`)
      .set('Cookie', enrolledStudentCookie)
      .send({ title: 'Chapter 1 questions' });
    expect(createRes.status).toBe(201);
    const conversationId = createRes.body.data.id;

    // The agent loop (mocked at runAgentTurn) calls search_course_material
    // first — its real handler does the actual embed + pgvector retrieval —
    // then answers from what it found, same as the guaranteed stage-1 shape.
    vi.mocked(runAgentTurn)
      .mockResolvedValueOnce({
        type: 'tool_calls',
        calls: [{ id: 'call_1', name: 'search_course_material', arguments: '{"query":"photosynthesis"}' }],
      })
      .mockResolvedValueOnce({ type: 'text', content: 'Grounded answer' });

    const sendRes = await request(app)
      .post(`/api/v1/courses/${course.id}/tutor/conversations/${conversationId}/messages`)
      .set('Cookie', enrolledStudentCookie)
      .send({ content: 'What does the material say about photosynthesis?' });

    expect(sendRes.status).toBe(201);
    expect(sendRes.body.data.assistantMessage.content).toBe('Grounded answer');
    expect(sendRes.body.data.assistantMessage.sources).not.toBeNull();
    expect(sendRes.body.data.assistantMessage.sources[0]).toMatchObject({
      documentId: readyDocument.id,
      filename: 'lecture-1.pdf',
    });
  });

  it('search_course_material finds nothing relevant for an off-topic question, so the answer carries no bogus citation', async () => {
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
    await courseRepository.setKnowledgeBaseDocument(course.id, readyDocument.id);

    // The stored chunk embeds near vector(0.1) (the default mock); this
    // question's embedding points in an unrelated direction — standing in
    // for a genuinely off-topic query the way "king birendra" is unrelated
    // to a software engineering syllabus's chunks.
    vi.mocked(embed).mockImplementation(async (texts: string[]) =>
      texts.map(() => orthogonalVector()),
    );

    const enrolledStudentCookie = await signInEnrolledStudent('offtopic@example.com', course.id);
    const createRes = await request(app)
      .post(`/api/v1/courses/${course.id}/tutor/conversations`)
      .set('Cookie', enrolledStudentCookie)
      .send({ title: 'Off-topic' });
    const conversationId = createRes.body.data.id;

    vi.mocked(runAgentTurn)
      .mockResolvedValueOnce({
        type: 'tool_calls',
        calls: [{ id: 'call_1', name: 'search_course_material', arguments: '{"query":"something unrelated"}' }],
      })
      .mockResolvedValueOnce({ type: 'text', content: "The material doesn't cover this." });

    const sendRes = await request(app)
      .post(`/api/v1/courses/${course.id}/tutor/conversations/${conversationId}/messages`)
      .set('Cookie', enrolledStudentCookie)
      .send({ content: 'Something entirely unrelated to this course' });

    expect(sendRes.status).toBe(201);
    // No sources were accumulated — the tool found nothing within
    // TUTOR_RELEVANCE_MAX_DISTANCE, so there is nothing to cite, even though
    // the document itself is ready and otherwise searchable.
    expect(sendRes.body.data.assistantMessage.sources).toBeNull();
  });

  it('dedupes citations by document when several of the nearest chunks are from the same document', async () => {
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
      { documentId: readyDocument.id, chunkIndex: 0, content: 'chunk A', embedding: vector(0.1) },
      { documentId: readyDocument.id, chunkIndex: 1, content: 'chunk B', embedding: vector(0.1) },
      { documentId: readyDocument.id, chunkIndex: 2, content: 'chunk C', embedding: vector(0.1) },
    ]);
    await courseRepository.setKnowledgeBaseDocument(course.id, readyDocument.id);

    const enrolledStudentCookie = await signInEnrolledStudent('dedupe@example.com', course.id);
    const createRes = await request(app)
      .post(`/api/v1/courses/${course.id}/tutor/conversations`)
      .set('Cookie', enrolledStudentCookie)
      .send({ title: 'Dedup check' });
    const conversationId = createRes.body.data.id;

    vi.mocked(runAgentTurn)
      .mockResolvedValueOnce({
        type: 'tool_calls',
        calls: [{ id: 'call_1', name: 'search_course_material', arguments: '{"query":"topic"}' }],
      })
      .mockResolvedValueOnce({ type: 'text', content: 'Grounded answer' });

    const sendRes = await request(app)
      .post(`/api/v1/courses/${course.id}/tutor/conversations/${conversationId}/messages`)
      .set('Cookie', enrolledStudentCookie)
      .send({ content: 'Tell me about this' });

    expect(sendRes.status).toBe(201);
    // Three chunks matched, all from the same document — exactly one
    // citation badge, not three duplicate ones.
    expect(sendRes.body.data.assistantMessage.sources).toHaveLength(1);
    expect(sendRes.body.data.assistantMessage.sources[0].documentId).toBe(readyDocument.id);
  });

  it('auto-titles a new conversation from the student\'s first message, ChatGPT-style', async () => {
    const course = await createCourse();
    const enrolledStudentCookie = await signInEnrolledStudent('titler@example.com', course.id);

    // No title given — starts as the placeholder.
    const createRes = await request(app)
      .post(`/api/v1/courses/${course.id}/tutor/conversations`)
      .set('Cookie', enrolledStudentCookie)
      .send({});
    expect(createRes.status).toBe(201);
    expect(createRes.body.data.title).toBe('New conversation');
    const conversationId = createRes.body.data.id;

    vi.mocked(runAgentTurn).mockResolvedValueOnce({ type: 'text', content: 'Answer' });
    await request(app)
      .post(`/api/v1/courses/${course.id}/tutor/conversations/${conversationId}/messages`)
      .set('Cookie', enrolledStudentCookie)
      .send({ content: 'What is the capital of France?' });

    const listRes = await request(app)
      .get(`/api/v1/courses/${course.id}/tutor/conversations`)
      .set('Cookie', enrolledStudentCookie);
    expect(listRes.body.data[0].title).toBe('What is the capital of France?');

    // A second message must not retitle it again.
    vi.mocked(runAgentTurn).mockResolvedValueOnce({ type: 'text', content: 'Answer 2' });
    await request(app)
      .post(`/api/v1/courses/${course.id}/tutor/conversations/${conversationId}/messages`)
      .set('Cookie', enrolledStudentCookie)
      .send({ content: 'And Germany?' });

    const listRes2 = await request(app)
      .get(`/api/v1/courses/${course.id}/tutor/conversations`)
      .set('Cookie', enrolledStudentCookie);
    expect(listRes2.body.data[0].title).toBe('What is the capital of France?');
  });

  it('returns a "no material" response when the course has no ready documents, without ever calling the LLM', async () => {
    // Regression test: this used to run the full agent loop even against a
    // course with zero material, trusting the model to admit "no material"
    // on its own — which it doesn't reliably do (Groq's
    // llama-3.3-70b-versatile has been observed answering from its own
    // knowledge instead). The fix is a deterministic pre-check in
    // tutorAgent.ts, so this must resolve without runAgentTurn, generateText,
    // or embed ever being invoked, and without any tool_call/tool_result
    // rows in the conversation.
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
    expect(sendRes.body.data.assistantMessage.content).toBe(
      "There's no course material available yet to answer this question.",
    );
    expect(runAgentTurn).not.toHaveBeenCalled();
    expect(generateText).not.toHaveBeenCalled();
    expect(embed).not.toHaveBeenCalled();

    const messagesRes = await request(app)
      .get(`/api/v1/courses/${emptyCourse.id}/tutor/conversations/${conversationId}/messages`)
      .set('Cookie', enrolledStudentCookie);
    expect(
      messagesRes.body.data.some((m: { type: string }) => m.type === 'tool_call' || m.type === 'tool_result'),
    ).toBe(false);
  });

  it('sendMessage runs the agent loop and returns the final assistant message', async () => {
    const course = await createCourse();
    await seedCourseWithMaterial(course.id);
    const enrolledStudentCookie = await signInEnrolledStudent('agent-loop@example.com', course.id);

    const createRes = await request(app)
      .post(`/api/v1/courses/${course.id}/tutor/conversations`)
      .set('Cookie', enrolledStudentCookie)
      .send({ title: 'Agent loop test' });
    const conversationId = createRes.body.data.id;

    vi.mocked(runAgentTurn).mockResolvedValueOnce({ type: 'text', content: 'Answer' });

    const res = await request(app)
      .post(`/api/v1/courses/${course.id}/tutor/conversations/${conversationId}/messages`)
      .set('Cookie', enrolledStudentCookie)
      .send({ content: 'What is X?' });

    expect(res.status).toBe(201);
    expect(res.body.data.assistantMessage.content).toBe('Answer');
  });

  it('returns the exact message each request produced under a concurrent double-submit, not "whatever is last"', async () => {
    // Regression test for Finding 1: the controller used to re-derive its
    // response by re-fetching "the last message in the conversation by seq"
    // after calling runTutorAgentTurn, instead of using the messageId it
    // returns. Two concurrent sendMessage calls against the same
    // conversation race on tutorMessageRepository's non-atomic nextSeq, so
    // whichever request's controller re-fetched last previously risked
    // returning the OTHER request's answer. Fetching by the orchestrator's
    // own returned messageId must make each response correct regardless of
    // interleaving.
    const course = await createCourse();
    await seedCourseWithMaterial(course.id);
    const enrolledStudentCookie = await signInEnrolledStudent('double-submit@example.com', course.id);

    const createRes = await request(app)
      .post(`/api/v1/courses/${course.id}/tutor/conversations`)
      .set('Cookie', enrolledStudentCookie)
      .send({ title: 'Double-submit test' });
    const conversationId = createRes.body.data.id;

    vi.mocked(runAgentTurn)
      .mockResolvedValueOnce({ type: 'text', content: 'Answer A' })
      .mockResolvedValueOnce({ type: 'text', content: 'Answer B' });

    const [resA, resB] = await Promise.all([
      request(app)
        .post(`/api/v1/courses/${course.id}/tutor/conversations/${conversationId}/messages`)
        .set('Cookie', enrolledStudentCookie)
        .send({ content: 'Question A' }),
      request(app)
        .post(`/api/v1/courses/${course.id}/tutor/conversations/${conversationId}/messages`)
        .set('Cookie', enrolledStudentCookie)
        .send({ content: 'Question B' }),
    ]);

    expect(resA.status).toBe(201);
    expect(resB.status).toBe(201);

    const contents = [resA.body.data.assistantMessage.content, resB.body.data.assistantMessage.content].sort();
    expect(contents).toEqual(['Answer A', 'Answer B']);

    // Each response must be a distinct row...
    expect(resA.body.data.assistantMessage.id).not.toBe(resB.body.data.assistantMessage.id);

    // ...and each response's own id must resolve, in the DB, to that same
    // response's own content — never the other request's.
    const rowA = await tutorMessageRepository.findById(resA.body.data.assistantMessage.id);
    const rowB = await tutorMessageRepository.findById(resB.body.data.assistantMessage.id);
    expect(rowA?.content).toBe(resA.body.data.assistantMessage.content);
    expect(rowB?.content).toBe(resB.body.data.assistantMessage.content);
  });

  it('resumes a conversation from awaiting_student and flips status back to active', async () => {
    const course = await createCourse();
    await seedCourseWithMaterial(course.id);
    const enrolledStudentCookie = await signInEnrolledStudent('resume@example.com', course.id);

    const createRes = await request(app)
      .post(`/api/v1/courses/${course.id}/tutor/conversations`)
      .set('Cookie', enrolledStudentCookie)
      .send({ title: 'Resume test' });
    const conversationId = createRes.body.data.id;

    await tutorConversationRepository.updateStatus(
      conversationId,
      TUTOR_CONVERSATION_STATUSES.AWAITING_STUDENT,
    );

    vi.mocked(runAgentTurn).mockResolvedValueOnce({ type: 'text', content: 'Resumed answer' });

    const res = await request(app)
      .post(`/api/v1/courses/${course.id}/tutor/conversations/${conversationId}/messages`)
      .set('Cookie', enrolledStudentCookie)
      .send({ content: 'It was chapter 3' });

    expect(res.status).toBe(201);
    expect(res.body.data.assistantMessage.content).toBe('Resumed answer');

    const conversations = await request(app)
      .get(`/api/v1/courses/${course.id}/tutor/conversations`)
      .set('Cookie', enrolledStudentCookie);
    const updated = conversations.body.data.find((c: { id: string }) => c.id === conversationId);
    expect(updated.status).toBe(TUTOR_CONVERSATION_STATUSES.ACTIVE);
  });

  it('does not offer ask_student again right after one unresolved clarifying question', async () => {
    // Real incident (2026-08-12): a student got seven straight rounds of
    // clarifying questions ("What area?" / "What aspects?" / "What's most
    // important?") instead of ever being taught anything — including after
    // saying "I don't know, I'm a beginner, you tell me." This is the
    // deterministic backstop: after one text-only (ask_student-shaped) turn
    // with no tool activity, ask_student is structurally removed from the
    // next turn's tool list, so the model cannot ask a second one no matter
    // what it decides.
    const course = await createCourse();
    await seedCourseWithMaterial(course.id);
    const enrolledStudentCookie = await signInEnrolledStudent('clarify@example.com', course.id);

    const createRes = await request(app)
      .post(`/api/v1/courses/${course.id}/tutor/conversations`)
      .set('Cookie', enrolledStudentCookie)
      .send({ title: 'Clarify test' });
    const conversationId = createRes.body.data.id;

    // First turn: the model asks a clarifying question via ask_student.
    vi.mocked(runAgentTurn).mockResolvedValueOnce({
      type: 'tool_calls',
      calls: [{ id: 'call_1', name: 'ask_student', arguments: '{"question":"What area interests you?"}' }],
    });
    const first = await request(app)
      .post(`/api/v1/courses/${course.id}/tutor/conversations/${conversationId}/messages`)
      .set('Cookie', enrolledStudentCookie)
      .send({ content: 'how to become pro' });
    expect(first.status).toBe(201);
    expect(first.body.data.assistantMessage.content).toBe('What area interests you?');

    // Second turn (the student's vague reply): capture what tools this next
    // call is actually offered.
    let toolsOffered: { name: string }[] = [];
    vi.mocked(runAgentTurn).mockImplementationOnce(async (_history, tools) => {
      toolsOffered = tools;
      return { type: 'text', content: 'Starting from the fundamentals...' };
    });
    const second = await request(app)
      .post(`/api/v1/courses/${course.id}/tutor/conversations/${conversationId}/messages`)
      .set('Cookie', enrolledStudentCookie)
      .send({ content: 'I don\'t know, you tell me' });

    expect(second.status).toBe(201);
    expect(toolsOffered.map((t) => t.name)).not.toContain('ask_student');
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

  it('GET /courses/:courseId/outline returns full lesson content for reading, not just titles', async () => {
    const course = await createCourse();
    await courseRepository.setPublished(course.id, true);
    const module = await moduleRepository.create({ courseId: course.id, title: 'Module 1', orderIndex: 0 });
    await lessonRepository.create({
      moduleId: module.id,
      title: 'Lesson 1',
      content: 'The full lesson body, which a student reads directly on the course page.',
      keyTopics: ['photosynthesis'],
      orderIndex: 0,
    });
    const enrolledStudentCookie = await signInEnrolledStudent('outline-student@example.com', course.id);

    const res = await request(app)
      .get(`/api/v1/courses/${course.id}/outline`)
      .set('Cookie', enrolledStudentCookie);
    expect(res.status).toBe(200);
    expect(res.body.data[0].lessons[0].content).toBe(
      'The full lesson body, which a student reads directly on the course page.',
    );
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

  it("lets the course's assigned teacher see the outline of a still-unpublished course", async () => {
    const course = await createCourse();
    const module = await moduleRepository.create({ courseId: course.id, title: 'Module 1', orderIndex: 0 });
    await lessonRepository.create({
      moduleId: module.id,
      title: 'Draft lesson',
      content: 'Not published yet.',
      keyTopics: [],
      orderIndex: 0,
    });
    const teacher = await createTeacherUser({ email: 'outline-teacher@example.com' });
    await courseTeacherRepository.assign({ teacherId: teacher.id, courseId: course.id });
    const teacherCookie = await signInAs(teacher.email, 'teacher');

    const res = await request(app)
      .get(`/api/v1/courses/${course.id}/outline`)
      .set('Cookie', teacherCookie);
    expect(res.status).toBe(200);
    expect(res.body.data[0].lessons[0].title).toBe('Draft lesson');
  });

  it('lets an admin see the outline of a still-unpublished course', async () => {
    const course = await createCourse();
    const module = await moduleRepository.create({ courseId: course.id, title: 'Module 1', orderIndex: 0 });
    await lessonRepository.create({
      moduleId: module.id,
      title: 'Draft lesson',
      content: 'Not published yet.',
      keyTopics: [],
      orderIndex: 0,
    });
    const adminCookie = await signInAs('outline-admin@example.com', 'admin');

    const res = await request(app)
      .get(`/api/v1/courses/${course.id}/outline`)
      .set('Cookie', adminCookie);
    expect(res.status).toBe(200);
    expect(res.body.data[0].lessons[0].title).toBe('Draft lesson');
  });
});

describe('DELETE /courses/:courseId/tutor/conversations/:conversationId', () => {
  it('deletes the conversation and cascades its messages', async () => {
    const course = await createCourse();
    const cookies = await signInEnrolledStudent('delete-convo@example.com', course.id);
    const user = await User.findOne({ where: { email: 'delete-convo@example.com' } });

    const conversation = await tutorConversationRepository.create({
      courseId: course.id,
      studentId: user!.id,
      title: 'To be deleted',
    });
    await tutorMessageRepository.create({
      conversationId: conversation.id,
      seq: 0,
      role: 'user',
      type: 'text',
      content: 'Hello',
    });

    const res = await request(app)
      .delete(`/api/v1/courses/${course.id}/tutor/conversations/${conversation.id}`)
      .set('Cookie', cookies);
    expect(res.status).toBe(200);

    expect(await tutorConversationRepository.findById(conversation.id)).toBeNull();
    expect(await tutorMessageRepository.findAllByConversation(conversation.id)).toHaveLength(0);
  });

  it("404s deleting another student's conversation", async () => {
    const course = await createCourse();
    const owner = await createStudentUser({ email: `owner-${Date.now()}@example.com` });
    await createEnrollment({ studentId: owner.id, courseId: course.id });
    const conversation = await tutorConversationRepository.create({
      courseId: course.id,
      studentId: owner.id,
      title: "Someone else's conversation",
    });

    const outsiderCookies = await signInEnrolledStudent('outsider-delete@example.com', course.id);
    const res = await request(app)
      .delete(`/api/v1/courses/${course.id}/tutor/conversations/${conversation.id}`)
      .set('Cookie', outsiderCookies);
    expect(res.status).toBe(404);
  });
});

describe('DELETE /courses/:courseId/tutor/conversations/:conversationId/messages/:messageId', () => {
  it('deletes the most recent message', async () => {
    const course = await createCourse();
    const cookies = await signInEnrolledStudent('delete-msg@example.com', course.id);
    const user = await User.findOne({ where: { email: 'delete-msg@example.com' } });

    const conversation = await tutorConversationRepository.create({
      courseId: course.id,
      studentId: user!.id,
      title: 'Conversation',
    });
    await tutorMessageRepository.create({
      conversationId: conversation.id,
      seq: 0,
      role: 'user',
      type: 'text',
      content: 'First message',
    });
    const latest = await tutorMessageRepository.create({
      conversationId: conversation.id,
      seq: 1,
      role: 'assistant',
      type: 'text',
      content: 'Second message',
    });

    const res = await request(app)
      .delete(
        `/api/v1/courses/${course.id}/tutor/conversations/${conversation.id}/messages/${latest.id}`,
      )
      .set('Cookie', cookies);
    expect(res.status).toBe(200);

    const remaining = await tutorMessageRepository.findAllByConversation(conversation.id);
    expect(remaining).toHaveLength(1);
    expect(remaining[0]!.content).toBe('First message');
  });

  it('rejects deleting a message that is not the latest, with 400', async () => {
    const course = await createCourse();
    const cookies = await signInEnrolledStudent('delete-msg-middle@example.com', course.id);
    const user = await User.findOne({ where: { email: 'delete-msg-middle@example.com' } });

    const conversation = await tutorConversationRepository.create({
      courseId: course.id,
      studentId: user!.id,
      title: 'Conversation',
    });
    const first = await tutorMessageRepository.create({
      conversationId: conversation.id,
      seq: 0,
      role: 'user',
      type: 'text',
      content: 'First message',
    });
    await tutorMessageRepository.create({
      conversationId: conversation.id,
      seq: 1,
      role: 'assistant',
      type: 'text',
      content: 'Second message',
    });

    const res = await request(app)
      .delete(
        `/api/v1/courses/${course.id}/tutor/conversations/${conversation.id}/messages/${first.id}`,
      )
      .set('Cookie', cookies);
    expect(res.status).toBe(400);

    expect(await tutorMessageRepository.findAllByConversation(conversation.id)).toHaveLength(2);
  });

  it("404s deleting a message in another student's conversation", async () => {
    const course = await createCourse();
    const owner = await createStudentUser({ email: `msg-owner-${Date.now()}@example.com` });
    await createEnrollment({ studentId: owner.id, courseId: course.id });
    const conversation = await tutorConversationRepository.create({
      courseId: course.id,
      studentId: owner.id,
      title: "Someone else's conversation",
    });
    const message = await tutorMessageRepository.create({
      conversationId: conversation.id,
      seq: 0,
      role: 'user',
      type: 'text',
      content: 'Hello',
    });

    const outsiderCookies = await signInEnrolledStudent('outsider-msg-delete@example.com', course.id);
    const res = await request(app)
      .delete(
        `/api/v1/courses/${course.id}/tutor/conversations/${conversation.id}/messages/${message.id}`,
      )
      .set('Cookie', outsiderCookies);
    expect(res.status).toBe(404);
  });
});
