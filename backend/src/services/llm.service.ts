import Groq from 'groq-sdk';

import { env } from '../config/env.js';
import type { AgentMessage, AgentTool, AgentTurnResult } from '../types/agent.types.js';

const groq = new Groq({ apiKey: env.GROQ_API_KEY });

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
  const completion = await groq.chat.completions.create({
    model: env.GROQ_MODEL,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.3,
    max_completion_tokens: maxCompletionTokens,
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) {
    throw new Error('Groq returned an empty response');
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
  const completion = await groq.chat.completions.create({
    model: env.GROQ_MODEL,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.3,
    max_completion_tokens: maxCompletionTokens,
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) {
    throw new Error('Groq returned an empty response');
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

  const completion = await groq.chat.completions.create({
    model: env.GROQ_MODEL,
    messages,
    tools: tools.map((t) => ({
      type: 'function' as const,
      function: { name: t.name, description: t.description, parameters: t.parameters },
    })),
    tool_choice: 'auto',
    temperature: 0.3,
  });

  const message = completion.choices[0]?.message;
  if (!message) {
    throw new Error('Groq returned an empty response');
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
