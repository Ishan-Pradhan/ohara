import Groq, { APIError, RateLimitError } from 'groq-sdk';

import { env } from '../config/env.js';
import type { AgentMessage, AgentTool, AgentTurnResult } from '../types/agent.types.js';

const groq = new Groq({ apiKey: env.GROQ_API_KEY });

/** Translates a raw Groq SDK error into a clean, user-safe message. Groq's
 * own error bodies are internal detail — raw JSON error codes, a
 * `failed_generation` snippet of the cut-off completion — that must never
 * reach a student/teacher: error.middleware.ts's generic-Error branch echoes
 * `err.message` verbatim in development, and every one of this file's
 * exports is the only place in the codebase that touches the Groq SDK
 * directly, so this is the one place that needs to catch it. Every export
 * below funnels its `groq.chat.completions.create` call through this. */
const toLlmError = (err: unknown): Error => {
  if (err instanceof APIError) {
    // Confirmed against a real exhausted account (2026-08-25): Groq's
    // structured `type`/`code` fields are identical ("tokens" /
    // "rate_limit_exceeded") for both a per-minute-too-large single request
    // AND a fully-exhausted daily quota — the error message text is the
    // only signal that distinguishes them, and it matters a lot: "try
    // again in a minute" is actively wrong advice for a daily cap that can
    // take much longer to recover. Matched on the SDK's own err.message
    // (which embeds the raw response body) rather than err.error, whose
    // unwrapping shape isn't consistent enough across error kinds to rely
    // on structurally.
    if (/tokens per day/i.test(err.message)) {
      return new Error(
        "The AI service has used its full quota for today — please try again tomorrow, or ask an administrator to check the Groq usage dashboard.",
      );
    }
    if (/tokens per minute/i.test(err.message)) {
      return new Error(
        'The AI service has reached its per-minute usage limit — please try again in a minute or two.',
      );
    }
    if (err instanceof RateLimitError) {
      // A rate limit Groq reported some other way (e.g. request-count based
      // RPM/RPD, which wouldn't mention "tokens" at all) — same guidance as
      // the per-minute case, since that's the more common shape in practice.
      return new Error(
        'The AI service has reached its usage limit for now — please try again in a few minutes.',
      );
    }
    // Covers e.g. json_validate_failed (JSON mode ran out of completion
    // tokens before finishing valid JSON) and any other 4xx/5xx Groq returns
    // — none of it is something a caller can act on beyond "try again".
    return new Error('The AI service could not complete this request — please try again.');
  }
  return err instanceof Error ? err : new Error('The AI service could not complete this request.');
};

/** One-shot JSON-mode chat completion. Callers are responsible for
 * validating the returned string is both valid JSON and matches whatever
 * shape they asked for — this is a thin transport wrapper, not a schema
 * enforcer (see courseContent.controller.ts for the parse/validate/retry
 * loop that uses this). The only file in the codebase that touches the Groq
 * SDK directly.
 *
 * maxCompletionTokens defaults to a modest budget (grading/quiz-gen output is
 * short); course structure generation passes a much larger explicit value
 * since a detailed, code/table-preserving multi-lesson response needs it —
 * otherwise the completion silently cuts off mid-JSON. */
export const generateJson = async (
  systemPrompt: string,
  userPrompt: string,
  maxCompletionTokens = 4096,
): Promise<string> => {
  let completion;
  try {
    completion = await groq.chat.completions.create({
      model: env.GROQ_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
      max_completion_tokens: maxCompletionTokens,
    });
  } catch (err) {
    throw toLlmError(err);
  }

  const content = completion.choices[0]?.message?.content;
  if (!content) {
    throw new Error('The AI service returned an empty response — please try again.');
  }

  return content;
};

/** Plain-text chat completion (no JSON mode) — used by the tutor, which
 * returns prose, not a structured object. Same transport-only contract as
 * generateJson: no retry/validation here, callers own that if they need it.
 *
 * maxCompletionTokens defaults to a short-prose budget (every current caller
 * — tutor stage-1, at-risk explanations, teacher/admin copilots, explain-a-
 * concept — asks for a few paragraphs at most). Leaving this uncapped left
 * output size entirely up to Groq's own default, which combined with a large
 * input is exactly how a request blows past the on_demand tier's 12,000 TPM
 * cap (a 413, distinct from the daily token cap) — the same class of bug
 * MODULE_CONTENT_RETRIEVAL_K (constants/index.ts) was already introduced to
 * avoid on the generateJson side. */
export const generateText = async (
  systemPrompt: string,
  userPrompt: string,
  maxCompletionTokens = 1024,
): Promise<string> => {
  let completion;
  try {
    completion = await groq.chat.completions.create({
      model: env.GROQ_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.3,
      max_completion_tokens: maxCompletionTokens,
    });
  } catch (err) {
    throw toLlmError(err);
  }

  const content = completion.choices[0]?.message?.content;
  if (!content) {
    throw new Error('The AI service returned an empty response — please try again.');
  }

  return content;
};

/** One turn of the agentic tutor loop. Maps our provider-agnostic
 * AgentMessage/AgentTool shapes onto Groq's OpenAI-compatible tool-calling
 * API — the same `groq.chat.completions.create` transport `generateJson`/
 * `generateText` already use, just with `tools` attached. This is the only
 * place that decides text-vs-tool-calls; the orchestrator (agent/tutorAgent.ts)
 * never touches the Groq SDK directly. */
export const runAgentTurn = async (
  history: AgentMessage[],
  tools: AgentTool[],
): Promise<AgentTurnResult> => {
  const messages = history.map((m) => {
    if (m.role === 'assistant') {
      return {
        role: 'assistant' as const,
        content: m.content,
        ...(m.toolCalls && m.toolCalls.length > 0
          ? {
              tool_calls: m.toolCalls.map((tc) => ({
                id: tc.id,
                type: 'function' as const,
                function: { name: tc.name, arguments: tc.arguments },
              })),
            }
          : {}),
      };
    }
    if (m.role === 'tool') {
      return { role: 'tool' as const, tool_call_id: m.toolCallId, content: m.content };
    }
    return { role: m.role, content: m.content };
  });

  let completion;
  try {
    completion = await groq.chat.completions.create({
      model: env.GROQ_MODEL,
      messages,
      tools: tools.map((t) => ({
        type: 'function' as const,
        function: { name: t.name, description: t.description, parameters: t.parameters },
      })),
      tool_choice: 'auto',
      temperature: 0.3,
    });
  } catch (err) {
    throw toLlmError(err);
  }

  const message = completion.choices[0]?.message;
  if (!message) {
    throw new Error('The AI service returned an empty response — please try again.');
  }

  if (message.tool_calls && message.tool_calls.length > 0) {
    return {
      type: 'tool_calls',
      calls: message.tool_calls.map((tc) => ({
        id: tc.id,
        name: tc.function.name,
        arguments: tc.function.arguments,
      })),
    };
  }

  return { type: 'text', content: message.content ?? '' };
};
