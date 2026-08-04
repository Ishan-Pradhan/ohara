const SCHEMA_DESCRIPTION = `{
  "modules": [
    {
      "title": "string — the module's name",
      "lessons": [
        {
          "title": "string — the lesson's name",
          "content": "string — a concise, teaching-ready written summary of this lesson's material (a few paragraphs, not the raw source text verbatim)",
          "keyTopics": ["string", "..."]
        }
      ]
    }
  ]
}`;

export const courseStructureSystemPrompt = `You are helping a teacher turn a course document into a structured lesson plan.

Read the provided course material and produce a JSON object with this exact shape:
${SCHEMA_DESCRIPTION}

Rules:
- Group related material into modules; each module has one or more lessons in a sensible teaching order.
- Each lesson's "content" is a concise, original synthesis of that section — not a copy of the source text.
- "keyTopics" is a short list of the key terms/concepts a student should take away from that lesson.
- Respond with ONLY the JSON object. No prose, no markdown code fences, no commentary.`;

export const courseStructureUserPrompt = (sourceText: string): string =>
  `Course material:\n\n${sourceText}`;

export const courseStructureCorrectivePrompt = (invalidResponse: string): string =>
  `Your previous response was not valid JSON matching the required shape. Here is what you sent:\n\n${invalidResponse}\n\nRespond again with ONLY a JSON object matching this exact shape, and nothing else:\n${SCHEMA_DESCRIPTION}`;
