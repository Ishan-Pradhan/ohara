import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';

vi.mock('../../src/services/llm.service.js', () => ({
  runAgentTurn: vi.fn(),
  generateText: vi.fn(),
}));

const { runTutorAgentTurn } = await import('../../src/agent/tutorAgent.js');
const { runAgentTurn, generateText } = await import('../../src/services/llm.service.js');
const { truncateAll, closeDb } = await import('../helpers/db.js');
const { createCourse, createStudentUser, createTeacherUser } = await import(
  '../helpers/institution.js'
);
const { documentRepository } = await import('../../src/repositories/documents.repository.js');
const { documentChunkRepository } = await import(
  '../../src/repositories/documentChunks.repository.js'
);
const { tutorConversationRepository } = await import(
  '../../src/repositories/tutorConversations.repository.js'
);
const { tutorMessageRepository } = await import('../../src/repositories/tutorMessages.repository.js');
const { AGENT_MAX_ITERATIONS, EMBEDDING_DIMENSIONS, TUTOR_MESSAGE_ROLES, TUTOR_MESSAGE_TYPES } =
  await import('../../src/constants/index.js');

/** A valid, non-zero embedding of the model's dimension — cosine distance is
 * undefined for the zero vector, so every fixture vector uses a constant
 * fill instead. Mirrors tests/integration/tutor.test.ts. */
const vector = (value: number): number[] => new Array(EMBEDDING_DIMENSIONS).fill(value) as number[];

/** Seeds a course with one ready document and one chunk, so tool handlers
 * and the stage-1 fallback both have real material to retrieve. */
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
};

const seedConversationWithQuestion = async (
  courseId: string,
  question = 'What is photosynthesis?',
): Promise<string> => {
  const student = await createStudentUser();
  const conversation = await tutorConversationRepository.create({
    courseId,
    studentId: student.id,
    title: 'Test conversation',
  });
  await tutorMessageRepository.create({
    conversationId: conversation.id,
    seq: 0,
    role: TUTOR_MESSAGE_ROLES.USER,
    type: TUTOR_MESSAGE_TYPES.TEXT,
    content: question,
  });
  return conversation.id;
};

beforeEach(async () => {
  await truncateAll();
  vi.mocked(runAgentTurn).mockReset();
  vi.mocked(generateText).mockReset();
  vi.mocked(generateText).mockResolvedValue('Fallback answer grounded in the material.');
});

afterAll(async () => {
  await closeDb();
});

describe('runTutorAgentTurn', () => {
  it('returns a text answer directly when the model needs no tools', async () => {
    const course = await createCourse();
    const conversationId = await seedConversationWithQuestion(course.id);
    vi.mocked(runAgentTurn).mockResolvedValueOnce({ type: 'text', content: 'Answer' });

    const result = await runTutorAgentTurn(conversationId, course.id);

    expect(result.content).toBe('Answer');
    expect(result.sources).toBeNull();
    expect(runAgentTurn).toHaveBeenCalledTimes(1);
  });

  it('executes a tool call, feeds the result back, and returns the eventual text answer', async () => {
    const course = await createCourse();
    await seedCourseWithMaterial(course.id);
    const conversationId = await seedConversationWithQuestion(course.id);

    vi.mocked(runAgentTurn)
      .mockResolvedValueOnce({
        type: 'tool_calls',
        calls: [{ id: 'call_1', name: 'search_course_material', arguments: '{"query":"photosynthesis"}' }],
      })
      .mockResolvedValueOnce({ type: 'text', content: 'Grounded answer' });

    const result = await runTutorAgentTurn(conversationId, course.id);

    expect(result.content).toBe('Grounded answer');
    expect(result.sources).not.toBeNull();
    expect(result.sources?.[0]?.filename).toBe('lecture-1.pdf');

    const messages = await tutorMessageRepository.findAllByConversation(conversationId);
    expect(messages.some((m) => m.type === 'tool_call')).toBe(true);
    expect(messages.some((m) => m.type === 'tool_result')).toBe(true);
    expect(runAgentTurn).toHaveBeenCalledTimes(2);
  });

  it('ask_student pauses the loop and sets the conversation to awaiting_student', async () => {
    const course = await createCourse();
    const conversationId = await seedConversationWithQuestion(course.id);

    vi.mocked(runAgentTurn).mockResolvedValueOnce({
      type: 'tool_calls',
      calls: [{ id: 'call_1', name: 'ask_student', arguments: '{"question":"Which chapter?"}' }],
    });

    const result = await runTutorAgentTurn(conversationId, course.id);

    expect(result.content).toBe('Which chapter?');
    expect(result.sources).toBeNull();

    const updated = await tutorConversationRepository.findById(conversationId);
    expect(updated?.status).toBe('awaiting_student');

    const messages = await tutorMessageRepository.findAllByConversation(conversationId);
    expect(messages.some((m) => m.role === TUTOR_MESSAGE_ROLES.ASSISTANT && m.content === 'Which chapter?')).toBe(
      true,
    );
  });

  it('replays history that includes a prior chart message without emitting an invalid assistant shape', async () => {
    // Regression test: a persisted chart-type row (role assistant, type
    // chart, content: null) must be skipped by toAgentHistory, not replayed
    // as a bare { role: 'assistant', content: null } with no toolCalls —
    // that shape is invalid for an OpenAI-compatible chat completion (a
    // null-content assistant message is only valid alongside a non-empty
    // tool_calls array).
    const course = await createCourse();
    const student = await createStudentUser();
    const conversation = await tutorConversationRepository.create({
      courseId: course.id,
      studentId: student.id,
      title: 'Chart history regression',
    });

    await tutorMessageRepository.create({
      conversationId: conversation.id,
      seq: 0,
      role: TUTOR_MESSAGE_ROLES.USER,
      type: TUTOR_MESSAGE_TYPES.TEXT,
      content: 'Can you show me an example curve?',
    });
    await tutorMessageRepository.create({
      conversationId: conversation.id,
      seq: 1,
      role: TUTOR_MESSAGE_ROLES.ASSISTANT,
      type: TUTOR_MESSAGE_TYPES.TOOL_CALL,
      content: null,
      toolCalls: [{ id: 'call_1', name: 'generate_chart', arguments: '{"type":"line"}' }],
    });
    await tutorMessageRepository.create({
      conversationId: conversation.id,
      seq: 2,
      role: TUTOR_MESSAGE_ROLES.TOOL,
      type: TUTOR_MESSAGE_TYPES.TOOL_RESULT,
      content: null,
      toolResult: { toolCallId: 'call_1', content: 'Chart "Example" generated and shown to the student.' },
    });
    await tutorMessageRepository.create({
      conversationId: conversation.id,
      seq: 3,
      role: TUTOR_MESSAGE_ROLES.ASSISTANT,
      type: TUTOR_MESSAGE_TYPES.CHART,
      content: null,
      chart: { type: 'line', title: 'Example', xLabel: 'x', yLabel: 'y', series: [] },
    });
    await tutorMessageRepository.create({
      conversationId: conversation.id,
      seq: 4,
      role: TUTOR_MESSAGE_ROLES.ASSISTANT,
      type: TUTOR_MESSAGE_TYPES.TEXT,
      content: "Here's an example curve.",
    });
    await tutorMessageRepository.create({
      conversationId: conversation.id,
      seq: 5,
      role: TUTOR_MESSAGE_ROLES.USER,
      type: TUTOR_MESSAGE_TYPES.TEXT,
      content: 'Thanks — what about a steeper one?',
    });

    let capturedHistory: unknown[] = [];
    vi.mocked(runAgentTurn).mockImplementationOnce((history) => {
      capturedHistory = history;
      return Promise.resolve({ type: 'text', content: 'New answer' });
    });

    const result = await runTutorAgentTurn(conversation.id, course.id);

    expect(result.content).toBe('New answer');
    // No replayed message may be a bare null-content assistant entry with
    // no tool calls — that's exactly the invalid shape the chart row used
    // to produce before the fix.
    for (const entry of capturedHistory as { role: string; content: unknown; toolCalls?: unknown[] }[]) {
      if (entry.role === 'assistant' && entry.content === null) {
        expect(entry.toolCalls && entry.toolCalls.length > 0).toBe(true);
      }
    }
  });

  it('falls back to the stage-1 grounded answer when the loop hits AGENT_MAX_ITERATIONS', async () => {
    const course = await createCourse();
    await seedCourseWithMaterial(course.id);
    const conversationId = await seedConversationWithQuestion(course.id);

    // Never a text answer — always another tool call, exceeding the cap.
    vi.mocked(runAgentTurn).mockResolvedValue({
      type: 'tool_calls',
      calls: [{ id: 'call_x', name: 'search_course_material', arguments: '{"query":"photosynthesis"}' }],
    });

    const result = await runTutorAgentTurn(conversationId, course.id);

    expect(result.content).toBeTruthy();
    expect(result.content).toBe('Fallback answer grounded in the material.');
    expect(runAgentTurn).toHaveBeenCalledTimes(AGENT_MAX_ITERATIONS);
    expect(generateText).toHaveBeenCalledTimes(1);
  });

  it('falls back to the stage-1 grounded answer when runAgentTurn throws', async () => {
    const course = await createCourse();
    await seedCourseWithMaterial(course.id);
    const conversationId = await seedConversationWithQuestion(course.id);

    vi.mocked(runAgentTurn).mockRejectedValueOnce(new Error('provider unavailable'));

    const result = await runTutorAgentTurn(conversationId, course.id);

    expect(result.content).toBeTruthy();
    expect(result.content).toBe('Fallback answer grounded in the material.');
  });
});
