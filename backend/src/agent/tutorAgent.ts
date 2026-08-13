import { runAgentTurn, generateText } from '../services/llm.service.js';
import { embed } from '../services/embeddings.service.js';
import { documentChunkRepository } from '../repositories/documentChunks.repository.js';
import { lessonRepository } from '../repositories/lessons.repository.js';
import { courseRepository } from '../repositories/courses.repository.js';
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
  TUTOR_RELEVANCE_MAX_DISTANCE,
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
  /**
   * The id of the `tutor_messages` row this result was persisted as, so the
   * caller (tutor.controller.ts) can fetch precisely that row instead of
   * assuming "the last message in the conversation" is this request's own —
   * that assumption breaks under a concurrent double-submit (`nextSeq` is a
   * non-atomic `SELECT MAX(seq)+1`) and whenever another write lands on this
   * conversation while this turn is still in flight. Null only when
   * persisting the answer itself failed (e.g. a DB blip) — in that case
   * there is genuinely no row to fetch.
   */
  messageId: string | null;
}

// Used only when the stage-1 fallback itself fails (e.g. the same LLM
// provider outage that broke the primary loop also breaks the fallback's
// own `generateText` call). Deliberately static — no LLM/embedding/DB call
// on this path — so it can never itself throw and leave the student with an
// uncaught rejection instead of a response.
const FALLBACK_UNAVAILABLE_MESSAGE =
  "I'm having trouble answering right now — please try again in a moment.";

// Deterministic — not model output. Used ONLY by the up-front short-circuit
// below, which has actually verified the course has zero ready material —
// that's a conclusive, course-wide fact, so the confident wording is
// accurate here. Grounding for "no material exists" cannot be left to the
// model to admit on its own: Groq's llama-3.3-70b-versatile has been
// observed answering from its own knowledge instead of refusing, despite
// the system prompt instructing it not to — see tutorAgentSystemPrompt's
// grounding rule, which is real but insufficient alone. This message is the
// code-level backstop.
const NO_MATERIAL_MESSAGE = "There's no course material available yet to answer this question.";

// stage1Fallback's own "nothing to work with" branches used to share
// NO_MATERIAL_MESSAGE with the up-front check above — wrong, because they
// mean something weaker and easy to get backwards: not "this course has no
// material" (the up-front check already ruled that out before stage1Fallback
// is ever reached — it's why the loop got this far at all), but "this one
// query, taken on its own, didn't retrieve anything." That's a real
// distinction, not pedantry: stage1Fallback is only ever reached after the
// PRIMARY loop has already failed for some unrelated reason (a Groq rate
// limit/outage/timeout, or hitting the iteration cap) and a short,
// context-dependent follow-up like "yes" naturally embeds to nothing close
// to any chunk. Telling the student the course has no material in that
// moment is actively false — material exists and answered the previous
// message fine — and points them at the wrong fix (re-upload docs) instead
// of the right one (rephrase, or just retry). Confirmed live: a student
// conversation hit Groq's on-demand daily token cap (429) mid-session; every
// subsequent short follow-up fell through to this exact wrong message
// (2026-08-12).
const STAGE1_NO_MATCH_MESSAGE =
  "I couldn't find anything specific to that in the course material — could you ask with a bit more detail, or try again in a moment?";

// How many of the most recent prior text messages (excluding the current,
// not-yet-answered question) to fold into stage1Fallback's single-shot
// prompt. stage1Fallback is deliberately not a multi-turn chat completion —
// it's one retrieve-then-answer call, same as stage-1 proper — but with zero
// history at all, a fallback triggered mid-conversation (agent loop error,
// AGENT_MAX_ITERATIONS reached, a JSON hiccup) answered as if the student had
// never said anything before, which reads as "lost the conversation" even
// though tutor_messages still has the full history. A short recency window
// fixes the jarring discontinuity without turning this into a second
// full-history code path to maintain.
const STAGE1_FALLBACK_HISTORY_MESSAGES = 6;

/** A raw, not-yet-persisted answer — the shape `stage1Fallback` and the
 * static-unavailable-message branch produce before a row id exists. */
interface RawAnswer {
  content: string;
  sources: TutorSource[] | null;
}

/** The stage-1 grounded answer, reused verbatim as this orchestrator's
 * fallback — identical retrieve-then-answer logic to tutor.controller.ts's
 * original sendMessage, just callable from here too. Zero retrieved chunks
 * still hard-skips the LLM call, same reasoning as stage-1. Takes the
 * course's resolved knowledgeBaseDocumentId directly (not courseId) — the
 * caller already looked up the course once for the up-front material check,
 * no reason to do it again here. */
const stage1Fallback = async (
  knowledgeBaseDocumentId: string | null,
  question: string,
  recentHistory: { role: 'user' | 'assistant'; content: string }[],
): Promise<RawAnswer> => {
  if (!knowledgeBaseDocumentId) {
    // The only branch here that's actually asserting "no material" — and
    // it's correct: no document is selected at all, course-wide, not just
    // for this one query.
    return { content: NO_MATERIAL_MESSAGE, sources: null };
  }
  const [queryVector] = await embed([question]);
  if (!queryVector) {
    return { content: STAGE1_NO_MATCH_MESSAGE, sources: null };
  }
  const chunks = await documentChunkRepository.findSimilar(
    knowledgeBaseDocumentId,
    queryVector,
    TUTOR_RETRIEVAL_K,
    TUTOR_RELEVANCE_MAX_DISTANCE,
  );
  if (chunks.length === 0) {
    return { content: STAGE1_NO_MATCH_MESSAGE, sources: null };
  }
  const excerpts = await Promise.all(
    chunks.map(async (chunk) => {
      const document = chunk.document ?? (await chunk.$get('document'));
      return {
        documentId: chunk.documentId,
        filename: document?.filename ?? 'Unknown document',
        chunkContent: chunk.content,
      };
    }),
  );
  // Citations are one badge per document, not per chunk — same reasoning as
  // searchCourseMaterial.tool.ts's identical dedup.
  const seenDocumentIds = new Set<string>();
  const sources = excerpts.filter((s) => {
    if (seenDocumentIds.has(s.documentId)) return false;
    seenDocumentIds.add(s.documentId);
    return true;
  });
  const userPrompt = tutorStage1UserPrompt(
    question,
    excerpts.map((s) => ({ filename: s.filename, content: s.chunkContent })),
    recentHistory,
  );
  const content = await generateText(tutorStage1SystemPrompt, userPrompt);
  return { content, sources };
};

const ORPHANED_TOOL_RESULT_PLACEHOLDER = 'Tool result unavailable due to a persistence error.';

/** Converts this conversation's persisted tutor_messages into the
 * AgentMessage[] shape runAgentTurn expects. This IS the resumable loop
 * state — no separate state machine, per ARCHITECTURE.md §7. */
const toAgentHistory = (systemPrompt: string, messages: TutorMessage[]): AgentMessage[] => {
  const history: AgentMessage[] = [{ role: 'system', content: systemPrompt }];
  for (let i = 0; i < messages.length; i++) {
    const m = messages[i]!;

    if (m.role === TUTOR_MESSAGE_ROLES.USER) {
      history.push({ role: 'user', content: m.content ?? '' });
      continue;
    }

    if (m.type === TUTOR_MESSAGE_TYPES.TOOL_CALL) {
      const toolCalls = (m.toolCalls as { id: string; name: string; arguments: string }[]) ?? [];
      history.push({ role: 'assistant', content: m.content, toolCalls });

      // Defensive replay (final-review Finding 3): the tool_call row is
      // persisted before its tool_result row(s). If a tool_result write then
      // fails (a transient DB blip), the tool_call row is left orphaned —
      // replaying it as-is would push an assistant message with toolCalls
      // immediately followed by a non-tool message, an invalid shape for
      // Groq's tool-calling API that would permanently break this
      // conversation into fallback-only mode. Consume whichever tool_result
      // rows actually follow (skipping over any interleaved chart rows,
      // which are never replayed — same reasoning as below), and synthesize
      // a placeholder result for any toolCallId that has none, so the
      // replayed history is always a valid shape regardless of what's
      // actually in the DB.
      const seenResultIds = new Set<string>();
      let j = i + 1;
      while (
        j < messages.length &&
        (messages[j]!.type === TUTOR_MESSAGE_TYPES.TOOL_RESULT || messages[j]!.type === TUTOR_MESSAGE_TYPES.CHART)
      ) {
        const next = messages[j]!;
        if (next.type === TUTOR_MESSAGE_TYPES.TOOL_RESULT) {
          const result = next.toolResult as { toolCallId: string; content: string };
          history.push({ role: 'tool', toolCallId: result.toolCallId, content: result.content });
          seenResultIds.add(result.toolCallId);
        }
        j++;
      }
      for (const call of toolCalls) {
        if (!seenResultIds.has(call.id)) {
          history.push({ role: 'tool', toolCallId: call.id, content: ORPHANED_TOOL_RESULT_PLACEHOLDER });
        }
      }
      i = j - 1;
      continue;
    }

    if (m.type === TUTOR_MESSAGE_TYPES.TOOL_RESULT) {
      // Only reached for a tool_result row not immediately preceded by its
      // tool_call row — shouldn't happen given the lookahead above (which
      // consumes paired tool_results as part of the TOOL_CALL branch), but
      // handled rather than assumed away.
      const result = m.toolResult as { toolCallId: string; content: string };
      history.push({ role: 'tool', toolCallId: result.toolCallId, content: result.content });
      continue;
    }

    if (m.type === TUTOR_MESSAGE_TYPES.CHART) {
      // Chart rows exist only so the frontend can render the chart bubble —
      // the model already "saw" this exchange via the paired tool_call/
      // tool_result rows from the same turn, replayed above. Replaying this
      // row too would push { role: 'assistant', content: null } with no
      // toolCalls, which is not a valid OpenAI-compatible message shape
      // (content: null is only valid alongside a non-empty tool_calls
      // array) — so it's skipped, not pushed, on purpose.
      continue;
    }

    // Plain assistant text (final answers, including past fallbacks).
    history.push({ role: 'assistant', content: m.content });
  }
  return history;
};

// How many consecutive text-only turns — no search_course_material,
// get_lesson, or generate_chart call anywhere before them — the tutor has
// answered with in a row. In practice this is almost always ask_student,
// which persists as a plain text row (see its handling below): a real,
// grounded answer nearly always involves a tool call first. Walking
// backward from the most recent message, a tool_call/tool_result/chart row
// ends the streak, since it means the model DID try to ground itself at
// that point. Real incident (2026-08-12): a student answering "how to
// become pro" got seven straight rounds of clarifying questions
// ("What area?" / "What aspects?" / "What's most important?") — including
// ones that ignored a search result the model had already retrieved — and
// kept going even after the student said "I don't know I am a beginner,
// you tell me." Prompt instructions alone ("don't ask a second clarifying
// question") aren't reliable enough on a 70B open model to trust as the
// only guard — this is the deterministic backstop, same reasoning as
// NO_MATERIAL_MESSAGE's up-front check above: paired with
// MAX_CONSECUTIVE_CLARIFICATIONS below, it makes the loop structurally
// unable to ask twice in a row, not just instructed not to.
const countTrailingClarificationStreak = (messages: TutorMessage[]): number => {
  let streak = 0;
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i]!;
    if (
      m.type === TUTOR_MESSAGE_TYPES.TOOL_CALL ||
      m.type === TUTOR_MESSAGE_TYPES.TOOL_RESULT ||
      m.type === TUTOR_MESSAGE_TYPES.CHART
    ) {
      break;
    }
    if (m.role === TUTOR_MESSAGE_ROLES.ASSISTANT && m.type === TUTOR_MESSAGE_TYPES.TEXT) {
      streak++;
    }
  }
  return streak;
};

// After this many consecutive clarification-shaped turns, ask_student is
// removed from the tool list for the next turn entirely — the model can
// still search or answer, it just structurally cannot ask a further
// clarifying question until it has actually tried grounding itself again.
const MAX_CONSECUTIVE_CLARIFICATIONS = 1;

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
 *
 * `learningContext` is an optional compact text block (produced by
 * `buildTutorLearningContext`) that is appended to the system prompt for this
 * turn only — it is not persisted, so it gets rebuilt fresh on every call,
 * which is intentional: the student's performance may have changed since the
 * last message and we always want the most current snapshot.
 */
export const runTutorAgentTurn = async (
  conversationId: string,
  courseId: string,
  learningContext?: string,
): Promise<TutorAgentResult> => {
  // A course may have several uploaded documents, but only the one the
  // teacher explicitly selected (Course.knowledgeBaseDocumentId) is ever
  // searched for RAG grounding — resolved once here and threaded through
  // the rest of this turn (tool calls, stage1Fallback) rather than each
  // consumer re-deriving it from courseId.
  const course = await courseRepository.findById(courseId);
  const knowledgeBaseDocumentId: string | null = course?.knowledgeBaseDocumentId ?? null;

  // Deterministic refusal, checked before any LLM call: if this course has
  // neither a selected, chunked knowledge-base document (search_course_material)
  // nor generated lesson content (get_lesson), there is nothing to ground an
  // answer in and no tool call the model could make would change that.
  // Skipping the loop entirely here — rather than letting the model reach
  // this conclusion itself — is the fix for the model answering from its
  // own knowledge instead of admitting there's no material (see
  // NO_MATERIAL_MESSAGE above). Checked as two separate existence queries,
  // not one join: DocumentChunks (via the selected document) and Lessons
  // (via Modules) are populated by entirely separate pipelines (RAG
  // ingestion vs. course structure generation) and a course can have either
  // without the other.
  const [hasChunks, hasLessons] = await Promise.all([
    knowledgeBaseDocumentId
      ? documentChunkRepository.existsForDocument(knowledgeBaseDocumentId)
      : Promise.resolve(false),
    lessonRepository.existsForCourse(courseId),
  ]);
  if (!hasChunks && !hasLessons) {
    const assistant = await persistText(conversationId, TUTOR_MESSAGE_ROLES.ASSISTANT, NO_MATERIAL_MESSAGE, null);
    return { content: assistant.content ?? NO_MATERIAL_MESSAGE, sources: null, messageId: assistant.id };
  }

  // Build the system prompt, optionally appending the current learning context.
  const systemPrompt = learningContext
    ? `${tutorAgentSystemPrompt}\n\n${learningContext}`
    : tutorAgentSystemPrompt;

  const priorMessages = await tutorMessageRepository.findAllByConversation(conversationId);
  const history = toAgentHistory(systemPrompt, priorMessages);

  // Computed once from history *before* this turn — see
  // countTrailingClarificationStreak's comment. Reused for every iteration
  // of this turn's loop: ask_student either resolves the loop immediately
  // when called (see below) or isn't offered at all, so there's no
  // mid-turn point where the streak could change.
  const toolsForThisTurn =
    countTrailingClarificationStreak(priorMessages) >= MAX_CONSECUTIVE_CLARIFICATIONS
      ? AGENT_TOOLS.filter((t) => t.name !== 'ask_student')
      : AGENT_TOOLS;

  // Known, deliberate limitation: this deadline only bounds time *between*
  // loop iterations (checked below, before each runAgentTurn call) — it has
  // no cancellation path for a single in-flight runAgentTurn call itself
  // (that would mean an AbortSignal threaded through the Groq SDK call in
  // llm.service.ts, out of scope here). A single hung/slow Groq call can
  // therefore still run past AGENT_TURN_TIMEOUT_MS before this loop gets a
  // chance to notice and break. Accepted trade-off, not an oversight.
  const deadline = Date.now() + AGENT_TURN_TIMEOUT_MS;
  // Sources for the eventual final text answer are whatever grounding tools
  // (search_course_material, get_lesson) returned across this turn's tool
  // calls, genuinely accumulated (deduped by documentId) here — local to
  // this call, never a module-level variable (that would leak across
  // concurrent requests for different conversations). A model that calls a
  // grounding tool more than once in one turn (e.g. two searches before
  // synthesizing a combined answer) must have both calls' sources attached
  // to the final message, not just the last call's.
  let accumulatedSources: TutorSource[] = [];

  try {
    for (let iteration = 0; iteration < AGENT_MAX_ITERATIONS; iteration++) {
      if (Date.now() > deadline) {
        break;
      }

      const turn = await runAgentTurn(history, toolsForThisTurn);

      if (turn.type === 'text') {
        const sourcesForAnswer = accumulatedSources.length > 0 ? accumulatedSources : null;
        const assistant = await persistText(conversationId, TUTOR_MESSAGE_ROLES.ASSISTANT, turn.content, sourcesForAnswer);
        return { content: assistant.content ?? turn.content, sources: sourcesForAnswer, messageId: assistant.id };
      }

      // turn.type === 'tool_calls'
      const askStudentCall = turn.calls.find((c) => c.name === 'ask_student');
      if (askStudentCall) {
        const { question } = askStudentArgsSchema.parse(JSON.parse(askStudentCall.arguments));
        const assistant = await persistText(conversationId, TUTOR_MESSAGE_ROLES.ASSISTANT, question);
        await tutorConversationRepository.updateStatus(conversationId, TUTOR_CONVERSATION_STATUSES.AWAITING_STUDENT);
        return { content: question, sources: null, messageId: assistant.id };
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
          result = await handler(call.arguments, { courseId, knowledgeBaseDocumentId });
        } catch (err) {
          logger.error(
            { err, conversationId, courseId, tool: call.name },
            'Tutor agent tool execution failed',
          );
          result = { content: `Tool error: ${err instanceof Error ? err.message : 'invalid input'}`, sources: null };
        }

        if (result.sources && result.sources.length > 0) {
          const seenDocumentIds = new Set(accumulatedSources.map((s) => s.documentId));
          const newSources = result.sources.filter((s) => !seenDocumentIds.has(s.documentId));
          accumulatedSources = [...accumulatedSources, ...newSources];
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
  let lastUserIndex = -1;
  for (let i = priorMessages.length - 1; i >= 0; i--) {
    if (priorMessages[i]!.role === TUTOR_MESSAGE_ROLES.USER) {
      lastUserIndex = i;
      break;
    }
  }
  const question = lastUserIndex >= 0 ? (priorMessages[lastUserIndex]!.content ?? '') : '';
  // Everything strictly before the current question, most recent last —
  // plain text turns only (tool_call/tool_result/chart rows are opaque
  // plumbing, not prose worth showing the model here).
  const recentHistory = priorMessages
    .slice(0, lastUserIndex === -1 ? 0 : lastUserIndex)
    .filter(
      (m): m is TutorMessage & { content: string } =>
        m.type === TUTOR_MESSAGE_TYPES.TEXT &&
        m.content !== null &&
        (m.role === TUTOR_MESSAGE_ROLES.USER || m.role === TUTOR_MESSAGE_ROLES.ASSISTANT),
    )
    .slice(-STAGE1_FALLBACK_HISTORY_MESSAGES)
    .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));

  let fallback: RawAnswer;
  try {
    fallback = await stage1Fallback(knowledgeBaseDocumentId, question, recentHistory);
  } catch (err) {
    logger.error({ err, conversationId, courseId }, 'Stage-1 fallback failed; returning static response');
    fallback = { content: FALLBACK_UNAVAILABLE_MESSAGE, sources: null };
  }

  let messageId: string | null = null;
  try {
    const persisted = await persistText(conversationId, TUTOR_MESSAGE_ROLES.ASSISTANT, fallback.content, fallback.sources);
    messageId = persisted.id;
  } catch (err) {
    // Even persisting the fallback failed (e.g. the DB itself is down) —
    // still return it rather than reject; there's nothing further this
    // function can do to guarantee persistence. messageId stays null, which
    // signals the caller there is genuinely no row to fetch.
    logger.error({ err, conversationId, courseId }, 'Failed to persist stage-1 fallback answer');
  }

  return { ...fallback, messageId };
};
