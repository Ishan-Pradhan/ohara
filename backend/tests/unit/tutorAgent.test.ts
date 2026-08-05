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
const { moduleRepository } = await import('../../src/repositories/modules.repository.js');
const { lessonRepository } = await import('../../src/repositories/lessons.repository.js');
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

    // Finding 1 regression: the returned messageId must identify the actual
    // persisted row for this answer, not just describe its content.
    expect(result.messageId).toBeTruthy();
    const persisted = await tutorMessageRepository.findById(result.messageId!);
    expect(persisted?.content).toBe('Answer');
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

    // Finding 1 regression: messageId must point at the row actually holding
    // this answer's content, not merely "whatever's last in the conversation".
    expect(result.messageId).toBeTruthy();
    const persisted = messages.find((m) => m.id === result.messageId);
    expect(persisted?.content).toBe('Grounded answer');
  });

  it('accumulates and dedupes sources across multiple grounding tool calls in one turn', async () => {
    // Finding 2 regression: a model that calls a grounding tool more than
    // once in a single turn (e.g. two get_lesson pulls before synthesizing a
    // combined answer) must have EVERY call's sources attached to the final
    // answer, deduped by documentId — not just the last call's (previously
    // `lastToolSources = result.sources` was last-write-wins).
    const course = await createCourse();
    const module = await moduleRepository.create({ courseId: course.id, title: 'Module 1', orderIndex: 0 });
    const lessonOne = await lessonRepository.create({
      moduleId: module.id,
      title: 'Lesson One',
      content: 'Content of lesson one.',
      keyTopics: ['topic-a'],
      orderIndex: 0,
    });
    const lessonTwo = await lessonRepository.create({
      moduleId: module.id,
      title: 'Lesson Two',
      content: 'Content of lesson two.',
      keyTopics: ['topic-b'],
      orderIndex: 1,
    });
    const conversationId = await seedConversationWithQuestion(course.id, 'Compare lesson one and two');

    vi.mocked(runAgentTurn)
      .mockResolvedValueOnce({
        type: 'tool_calls',
        calls: [
          { id: 'call_1', name: 'get_lesson', arguments: JSON.stringify({ lessonId: lessonOne.id }) },
          { id: 'call_2', name: 'get_lesson', arguments: JSON.stringify({ lessonId: lessonTwo.id }) },
          // Same lessonId as call_1 again, in the same turn — must not
          // produce a duplicate source entry.
          { id: 'call_3', name: 'get_lesson', arguments: JSON.stringify({ lessonId: lessonOne.id }) },
        ],
      })
      .mockResolvedValueOnce({ type: 'text', content: 'Comparison answer' });

    const result = await runTutorAgentTurn(conversationId, course.id);

    expect(result.content).toBe('Comparison answer');
    expect(result.sources).not.toBeNull();
    expect(result.sources).toHaveLength(2);
    const documentIds = result.sources!.map((s) => s.documentId).sort();
    expect(documentIds).toEqual([lessonOne.id, lessonTwo.id].sort());
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
    expect(result.messageId).toBeTruthy();

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

  it('replays an orphaned tool_call row (missing one of its tool_result pairs) as a valid, alternating history', async () => {
    // Regression test for Finding 3: if the tool_result write for one call
    // in a multi-call tool_call row fails after the tool_call row itself was
    // already persisted, the DB is left with a tool_call row (2 toolCalls)
    // paired with only 1 tool_result row. Replaying that as-is would produce
    // an assistant message with toolCalls immediately followed by a plain
    // assistant message — an invalid shape for Groq's tool-calling API that
    // would permanently break the conversation into fallback-only mode.
    // toAgentHistory must synthesize a placeholder result for the missing
    // call id so every replay stays a valid alternating shape.
    const course = await createCourse();
    const student = await createStudentUser();
    const conversation = await tutorConversationRepository.create({
      courseId: course.id,
      studentId: student.id,
      title: 'Orphaned tool_call regression',
    });

    await tutorMessageRepository.create({
      conversationId: conversation.id,
      seq: 0,
      role: TUTOR_MESSAGE_ROLES.USER,
      type: TUTOR_MESSAGE_TYPES.TEXT,
      content: 'What do lesson one and two cover?',
    });
    // The tool_call row commits with two calls...
    await tutorMessageRepository.create({
      conversationId: conversation.id,
      seq: 1,
      role: TUTOR_MESSAGE_ROLES.ASSISTANT,
      type: TUTOR_MESSAGE_TYPES.TOOL_CALL,
      content: null,
      toolCalls: [
        { id: 'call_1', name: 'get_lesson', arguments: '{"lessonId":"11111111-1111-1111-1111-111111111111"}' },
        { id: 'call_2', name: 'get_lesson', arguments: '{"lessonId":"22222222-2222-2222-2222-222222222222"}' },
      ],
    });
    // ...but only call_1's tool_result write succeeded before the DB blip —
    // call_2's tool_result row was never persisted.
    await tutorMessageRepository.create({
      conversationId: conversation.id,
      seq: 2,
      role: TUTOR_MESSAGE_ROLES.TOOL,
      type: TUTOR_MESSAGE_TYPES.TOOL_RESULT,
      content: null,
      toolResult: { toolCallId: 'call_1', content: '[Lesson: "Lesson One"]\nContent of lesson one.' },
    });
    // The outer catch caught the thrown write and fell back to stage-1,
    // whose answer was persisted as a plain text row right after.
    await tutorMessageRepository.create({
      conversationId: conversation.id,
      seq: 3,
      role: TUTOR_MESSAGE_ROLES.ASSISTANT,
      type: TUTOR_MESSAGE_TYPES.TEXT,
      content: "There's no course material available yet to answer this question.",
    });
    await tutorMessageRepository.create({
      conversationId: conversation.id,
      seq: 4,
      role: TUTOR_MESSAGE_ROLES.USER,
      type: TUTOR_MESSAGE_TYPES.TEXT,
      content: 'Okay, what about lesson two specifically?',
    });

    let capturedHistory: { role: string; content: unknown; toolCalls?: { id: string }[] }[] = [];
    vi.mocked(runAgentTurn).mockImplementationOnce((history) => {
      capturedHistory = history as typeof capturedHistory;
      return Promise.resolve({ type: 'text', content: 'Answer about lesson two' });
    });

    const result = await runTutorAgentTurn(conversation.id, course.id);

    expect(result.content).toBe('Answer about lesson two');
    // runAgentTurn must have been called at all — if the replayed history
    // were invalid and the mock threw, the outer catch would have swallowed
    // it and fallen back to stage-1 instead of resolving 'Answer about lesson two'.
    expect(runAgentTurn).toHaveBeenCalledTimes(1);

    // The tool_call entry (2 toolCalls) must be immediately followed by
    // exactly 2 tool-role entries — one real, one synthesized placeholder —
    // never by a non-tool entry.
    const toolCallIndex = capturedHistory.findIndex(
      (entry) => entry.role === 'assistant' && (entry.toolCalls?.length ?? 0) > 0,
    );
    expect(toolCallIndex).toBeGreaterThanOrEqual(0);
    const toolCallIds = capturedHistory[toolCallIndex]!.toolCalls!.map((c) => c.id);
    expect(toolCallIds).toEqual(['call_1', 'call_2']);

    const followingEntries = capturedHistory.slice(toolCallIndex + 1, toolCallIndex + 3);
    expect(followingEntries.every((entry) => entry.role === 'tool')).toBe(true);
    const followingContents = followingEntries.map((entry) => entry.content);
    expect(followingContents).toContain('[Lesson: "Lesson One"]\nContent of lesson one.');
    expect(followingContents).toContain('Tool result unavailable due to a persistence error.');
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

  it('resolves with a static message, and never rejects, when both the primary loop and the stage-1 fallback fail', async () => {
    const course = await createCourse();
    // Real material so stage1Fallback gets past its own "no material" hard
    // branch and actually reaches (and fails at) generateText — the same
    // provider outage that broke the primary loop is the realistic trigger
    // for this, per the review finding.
    await seedCourseWithMaterial(course.id);
    const conversationId = await seedConversationWithQuestion(course.id);

    vi.mocked(runAgentTurn).mockRejectedValueOnce(new Error('provider unavailable'));
    vi.mocked(generateText).mockRejectedValueOnce(new Error('provider unavailable'));

    const result = await runTutorAgentTurn(conversationId, course.id);

    expect(result.content).toBe(
      "I'm having trouble answering right now — please try again in a moment.",
    );
    expect(result.sources).toBeNull();

    // The static message must still be persisted, exactly like any other
    // fallback answer, so the conversation history isn't silently missing
    // a turn.
    const messages = await tutorMessageRepository.findAllByConversation(conversationId);
    const persisted = messages.find(
      (m) =>
        m.role === TUTOR_MESSAGE_ROLES.ASSISTANT &&
        m.content === "I'm having trouble answering right now — please try again in a moment.",
    );
    expect(persisted).toBeTruthy();
  });
});
