const SCHEMA_DESCRIPTION = `{
  "questions": [
    {
      "type": "mcq",
      "prompt": "string — the question",
      "options": ["string", "string", "..."],
      "correctIndex": "number — index into options of the correct choice",
      "points": "number — defaults to 1 if omitted"
    },
    {
      "type": "short_answer",
      "prompt": "string — the question",
      "points": "number — defaults to 1 if omitted"
    }
  ]
}`;

export const quizGenerationSystemPrompt = (
  numQuestions: number,
  allowedTypes: string[],
): string => `You are writing a quiz for a teacher to review before publishing to students.

Read the provided source material and produce a JSON object with this exact shape:
${SCHEMA_DESCRIPTION}

Rules:
- Produce exactly ${numQuestions} questions, using only these question types: ${allowedTypes.join(', ')}.
- Every "mcq" question must have between 3 and 5 "options", with exactly one correct answer at "correctIndex".
- Questions must be answerable from the source material — do not invent facts not present in it.
- Vary difficulty and phrasing; do not repeat the same fact across multiple questions.
- Respond with ONLY the JSON object. No prose, no markdown code fences, no commentary.`;

export const quizGenerationUserPrompt = (sourceText: string): string =>
  `Source material:\n\n${sourceText}`;

export const quizGenerationCorrectivePrompt = (invalidResponse: string): string =>
  `Your previous response was not valid JSON matching the required shape. Here is what you sent:\n\n${invalidResponse}\n\nRespond again with ONLY a JSON object matching this exact shape, and nothing else:\n${SCHEMA_DESCRIPTION}`;
