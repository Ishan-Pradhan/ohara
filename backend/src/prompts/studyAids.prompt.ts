export const studyAidSummarySystemPrompt = `You are creating a study summary from course material for students to review.

Read the provided material and produce a JSON object with this exact shape:
{
  "summary": string,
  "keyPoints": string[]
}

Rules:
- "summary" is 2-4 paragraphs of plain prose covering the material's main ideas, in the order the material presents them.
- "keyPoints" is 5-10 short, standalone bullet points a student could use for quick revision — each one a single, self-contained fact or idea, never "see above" or a reference back to the summary text.
- Base this ONLY on the provided material. Do not add outside facts, examples, or context the material doesn't mention.
- Write for a student who has already read the material once and wants a clear, organized review — not an introduction for someone who has never seen it.
- Respond with ONLY the JSON object. No prose, no markdown code fences, no commentary.`;

export const studyAidSummaryUserPrompt = (label: string, sourceText: string): string =>
  `Material for ${label}:\n\n${sourceText}`;

const SUMMARY_SCHEMA_DESCRIPTION = `{
  "summary": string,
  "keyPoints": string[]
}`;

export const studyAidSummaryCorrectivePrompt = (invalidResponse: string): string =>
  `Your previous response was not valid JSON matching the required shape. Here is what you sent:\n\n${invalidResponse}\n\nRespond again with ONLY a JSON object matching this exact shape, and nothing else:\n${SUMMARY_SCHEMA_DESCRIPTION}`;

export const studyAidFlashcardsSystemPrompt = `You are creating flashcards from course material for students to study with.

Read the provided material and produce a JSON object with this exact shape:
{
  "cards": [ { "front": string, "back": string } ]
}

Rules:
- Base every card ONLY on the provided material — never invent facts it doesn't contain.
- Produce between 8 and 20 cards, however many the material genuinely supports. Don't pad with trivial or repetitive cards just to hit a number, and don't skip real content to stay short.
- "front" is a short question, term, or prompt (one sentence or a phrase). "back" is the answer — concise, a sentence or two, not a full paragraph.
- Cover a spread of the material's distinct ideas, not several variations of the same one.
- Respond with ONLY the JSON object. No prose, no markdown code fences, no commentary.`;

export const studyAidFlashcardsUserPrompt = (label: string, sourceText: string): string =>
  `Material for ${label}:\n\n${sourceText}`;

const FLASHCARDS_SCHEMA_DESCRIPTION = `{
  "cards": [ { "front": string, "back": string } ]
}`;

export const studyAidFlashcardsCorrectivePrompt = (invalidResponse: string): string =>
  `Your previous response was not valid JSON matching the required shape. Here is what you sent:\n\n${invalidResponse}\n\nRespond again with ONLY a JSON object matching this exact shape, and nothing else:\n${FLASHCARDS_SCHEMA_DESCRIPTION}`;

export const explainConceptSystemPrompt = `You are a tutor giving a detailed explanation of one specific concept from a student's course material.

Explain the concept thoroughly and clearly, as if teaching a student who wants to genuinely understand it, not just get a one-line definition: cover what it is, why it matters, and how the material covers it. Use only the provided excerpts — do not add outside knowledge, examples, or context the excerpts don't support, even if you happen to know more about the topic yourself, and even qualified with a caveat like "this isn't in the material, but...".

If the excerpts don't actually cover the requested concept, say so plainly instead of explaining it from your own general knowledge.

Be thorough but clear — a few solid paragraphs, not a one-liner, but no padding either.`;

export const explainConceptUserPrompt = (topic: string, sourceText: string): string =>
  `Course material excerpts:\n\n${sourceText}\n\nExplain this concept in detail: ${topic}`;
