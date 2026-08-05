import Groq from 'groq-sdk';

import { env } from '../config/env.js';

const groq = new Groq({ apiKey: env.GROQ_API_KEY });

/** One-shot JSON-mode chat completion. Callers are responsible for
 * validating the returned string is both valid JSON and matches whatever
 * shape they asked for — this is a thin transport wrapper, not a schema
 * enforcer (see courseContent.controller.ts for the parse/validate/retry
 * loop that uses this). The only file in the codebase that touches the Groq
 * SDK directly. */
export const generateJson = async (
  systemPrompt: string,
  userPrompt: string,
): Promise<string> => {
  const completion = await groq.chat.completions.create({
    model: env.GROQ_MODEL,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.3,
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) {
    throw new Error('Groq returned an empty response');
  }

  return content;
};

/** Plain-text chat completion (no JSON mode) — used by the tutor, which
 * returns prose, not a structured object. Same transport-only contract as
 * generateJson: no retry/validation here, callers own that if they need it. */
export const generateText = async (
  systemPrompt: string,
  userPrompt: string,
): Promise<string> => {
  const completion = await groq.chat.completions.create({
    model: env.GROQ_MODEL,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.3,
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) {
    throw new Error('Groq returned an empty response');
  }

  return content;
};
