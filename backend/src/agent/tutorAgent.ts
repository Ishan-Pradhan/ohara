import { runAgentTurn, generateText } from '../services/llm.service.js';
import { embed } from '../services/embeddings.service.js';
import { documentChunkRepository } from '../repositories/documentChunks.repository.js';
import { tutorMessageRepository } from '../repositories/tutorMessages.repository.js';
import { tutorConversationRepository } from '../repositories/tutorConversations.repository.js';
import { AGENT_TOOLS, TOOL_HANDLERS, type ToolExecutionResult } from './tools/index.js';
import { askStudentArgsSchema } from './tools/askStudent.tool.js';
import { tutorAgentSystemPrompt } from '../prompts/tutorAgent.prompt.js';
import { tutorStage1SystemPrompt, tutorStage1UserPrompt } from '../prompts/tutorStage1.prompt.js';
import { logger } from '../utils/logger.js';
import {
  AGENT_MAX_ITERATIONS,
  AGENT_TURN_TIMEOUT_MS,
  TUTOR_RETRIEVAL_K,
  TUTOR_CONVERSATION_STATUSES,
  TUTOR_MESSAGE_ROLES,
  TUTOR_MESSAGE_TYPES,
} from '../constants/index.js';
import type { AgentMessage } from '../types/agent.types.js';
import type { TutorSource } from '../types/tutor.types.js';
import type { TutorMessage } from '../models/tutorMessages.model.js';

export interface TutorAgentResult {
  content: string;
  sources: TutorSource[] | null;
}

// Used only when the stage-1 fallback itself fails (e.g. the same LLM
// provider outage that broke the primary loop also breaks the fallback's
// own `generateText` call). Deliberately static — no LLM/embedding/DB call
// on this path — so it can never itself throw and leave the student with an
// uncaught rejection instead of a response.
const FALLBACK_UNAVAILABLE_MESSAGE =
  "I'm having trouble answering right now — please try again in a moment.";

/** The stage-1 grounded answer, reused verbatim as this orchestrator's
 * fallback — identical retrieve-then-answer logic to tutor.controller.ts's
 * original sendMessage, just callable from here too. Zero retrieved chunks
 * still hard-skips the LLM call, same reasoning as stage-1. */
const stage1Fallback = async (courseId: string, question: string): Promise<TutorAgentResult> => {
  const [queryVector] = await embed([question]);
  if (!queryVector) {
    return { content: "There's no course material available yet to answer this question.", sources: null };
  }
  const chunks = await documentChunkRepository.findSimilar(courseId, queryVector, TUTOR_RETRIEVAL_K);
  if (chunks.length === 0) {
    return { content: "There's no course material available yet to answer this question.", sources: null };
  }
  const sources = await Promise.all(
    chunks.map(async (chunk) => {
      const document = chunk.document ?? (await chunk.$get('document'));
      return {
        documentId: chunk.documentId,
        filename: document?.filename ?? 'Unknown document',
        chunkContent: chunk.content,
      };
    }),
  );
  const userPrompt = tutorStage1UserPrompt(question, sources.map((s) => ({ filename: s.filename, content: s.chunkContent })));
  const content = await generateText(tutorStage1SystemPrompt, userPrompt);
  return { content, sources };
};

/** Converts this conversation's persisted tutor_messages into the
 * AgentMessage[] shape runAgentTurn expects. This IS the resumable loop
 * state — no separate state machine, per ARCHITECTURE.md §7. */
const toAgentHistory = (systemPrompt: string, messages: TutorMessage[]): AgentMessage[] => {
  const history: AgentMessage[] = [{ role: 'system', content: systemPrompt }];
  for (const m of messages) {
    if (m.role === TUTOR_MESSAGE_ROLES.USER) {
      history.push({ role: 'user', content: m.content ?? '' });
    } else if (m.type === TUTOR_MESSAGE_TYPES.TOOL_CALL) {
      history.push({
        role: 'assistant',
        content: m.content,
        toolCalls: (m.toolCalls as { id: string; name: string; arguments: string }[]) ?? [],
      });
    } else if (m.type === TUTOR_MESSAGE_TYPES.TOOL_RESULT) {
      const result = m.toolResult as { toolCallId: string; content: string };
      history.push({ role: 'tool', toolCallId: result.toolCallId, content: result.content });
    } else if (m.type === TUTOR_MESSAGE_TYPES.CHART) {
      // Chart rows exist only so the frontend can render the chart bubble —
      // the model already "saw" this exchange via the paired tool_call/
      // tool_result rows from the same turn, replayed above. Replaying this
      // row too would push { role: 'assistant', content: null } with no
      // toolCalls, which is not a valid OpenAI-compatible message shape
      // (content: null is only valid alongside a non-empty tool_calls
      // array) — so it's skipped, not pushed, on purpose.
    } else {
      // Plain assistant text (final answers, including past fallbacks).
      history.push({ role: 'assistant', content: m.content });
    }
  }
  return history;
};

const persistText = async (
  conversationId: string,
  role: 'user' | 'assistant',
  content: string,
  sources: TutorSource[] | null = null,
) => {
  const seq = await tutorMessageRepository.nextSeq(conversationId);
  return tutorMessageRepository.create({
    conversationId,
    seq,
    role,
    type: TUTOR_MESSAGE_TYPES.TEXT,
    content,
    sources,
  });
};

/**
 * The bounded agent loop's public entry point. `question` has already been
 * persisted as the triggering user message by the caller (tutor.controller.ts)
 * before this runs, UNLESS this is a resume from `awaiting_student` — see
 * Task 4 for exactly which case does which; this function itself only reads
 * history and appends going forward, it never assumes who wrote the last row.
 */
export const runTutorAgentTurn = async (
  conversationId: string,
  courseId: string,
): Promise<TutorAgentResult> => {
  const priorMessages = await tutorMessageRepository.findAllByConversation(conversationId);
  const history = toAgentHistory(tutorAgentSystemPrompt, priorMessages);

  // Known, deliberate limitation: this deadline only bounds time *between*
  // loop iterations (checked below, before each runAgentTurn call) — it has
  // no cancellation path for a single in-flight runAgentTurn call itself
  // (that would mean an AbortSignal threaded through the Groq SDK call in
  // llm.service.ts, out of scope here). A single hung/slow Groq call can
  // therefore still run past AGENT_TURN_TIMEOUT_MS before this loop gets a
  // chance to notice and break. Accepted trade-off, not an oversight.
  const deadline = Date.now() + AGENT_TURN_TIMEOUT_MS;
  // Sources for the eventual final text answer are whatever
  // search_course_material returned across this turn's tool calls,
  // accumulated here — local to this call, never a module-level variable
  // (that would leak across concurrent requests for different conversations).
  let lastToolSources: TutorSource[] | null = null;

  try {
    for (let iteration = 0; iteration < AGENT_MAX_ITERATIONS; iteration++) {
      if (Date.now() > deadline) {
        break;
      }

      const turn = await runAgentTurn(history, AGENT_TOOLS);

      if (turn.type === 'text') {
        const assistant = await persistText(conversationId, TUTOR_MESSAGE_ROLES.ASSISTANT, turn.content, lastToolSources);
        return { content: assistant.content ?? turn.content, sources: lastToolSources };
      }

      // turn.type === 'tool_calls'
      const askStudentCall = turn.calls.find((c) => c.name === 'ask_student');
      if (askStudentCall) {
        const { question } = askStudentArgsSchema.parse(JSON.parse(askStudentCall.arguments));
        await persistText(conversationId, TUTOR_MESSAGE_ROLES.ASSISTANT, question);
        await tutorConversationRepository.updateStatus(conversationId, TUTOR_CONVERSATION_STATUSES.AWAITING_STUDENT);
        return { content: question, sources: null };
      }

      // Persist the assistant's tool_call message, then execute each tool
      // and persist its tool_result, appending both to the in-memory
      // history so the next iteration's runAgentTurn sees them.
      const toolCallSeq = await tutorMessageRepository.nextSeq(conversationId);
      await tutorMessageRepository.create({
        conversationId,
        seq: toolCallSeq,
        role: TUTOR_MESSAGE_ROLES.ASSISTANT,
        type: TUTOR_MESSAGE_TYPES.TOOL_CALL,
        content: null,
        toolCalls: turn.calls,
      });
      history.push({ role: 'assistant', content: null, toolCalls: turn.calls });

      for (const call of turn.calls) {
        const handler = TOOL_HANDLERS[call.name];
        let result: ToolExecutionResult;
        try {
          if (!handler) throw new Error(`Unknown tool: ${call.name}`);
          result = await handler(call.arguments, { courseId });
        } catch (err) {
          logger.error(
            { err, conversationId, courseId, tool: call.name },
            'Tutor agent tool execution failed',
          );
          result = { content: `Tool error: ${err instanceof Error ? err.message : 'invalid input'}`, sources: null };
        }

        if (result.sources) {
          lastToolSources = result.sources;
        }

        const resultSeq = await tutorMessageRepository.nextSeq(conversationId);
        await tutorMessageRepository.create({
          conversationId,
          seq: resultSeq,
          role: TUTOR_MESSAGE_ROLES.TOOL,
          type: TUTOR_MESSAGE_TYPES.TOOL_RESULT,
          content: null,
          toolResult: { toolCallId: call.id, content: result.content },
          chart: result.chart ?? null,
        });
        history.push({ role: 'tool', toolCallId: call.id, content: result.content });

        if (result.chart) {
          const chartSeq = await tutorMessageRepository.nextSeq(conversationId);
          await tutorMessageRepository.create({
            conversationId,
            seq: chartSeq,
            role: TUTOR_MESSAGE_ROLES.ASSISTANT,
            type: TUTOR_MESSAGE_TYPES.CHART,
            content: null,
            chart: result.chart,
          });
        }
      }
    }
  } catch (err) {
    // Any agent-loop error: fall through to the stage-1 fallback below.
    logger.error({ err, conversationId, courseId }, 'Tutor agent loop failed; falling back to stage-1 answer');
  }

  // Hit the cap, timed out, or errored — the guaranteed answer. The fallback
  // itself is guarded too: if the same outage that broke the primary loop
  // (e.g. the LLM provider being down) also breaks stage1Fallback's own
  // generateText call, we must still resolve with something rather than
  // reject — that would otherwise surface as a raw 500 to the student in
  // exactly the scenario this whole function exists to prevent.
  const question = [...priorMessages].reverse().find((m) => m.role === TUTOR_MESSAGE_ROLES.USER)?.content ?? '';
  let fallback: TutorAgentResult;
  try {
    fallback = await stage1Fallback(courseId, question);
  } catch (err) {
    logger.error({ err, conversationId, courseId }, 'Stage-1 fallback failed; returning static response');
    fallback = { content: FALLBACK_UNAVAILABLE_MESSAGE, sources: null };
  }

  try {
    await persistText(conversationId, TUTOR_MESSAGE_ROLES.ASSISTANT, fallback.content, fallback.sources);
  } catch (err) {
    // Even persisting the fallback failed (e.g. the DB itself is down) —
    // still return it rather than reject; there's nothing further this
    // function can do to guarantee persistence.
    logger.error({ err, conversationId, courseId }, 'Failed to persist stage-1 fallback answer');
  }

  return fallback;
};
