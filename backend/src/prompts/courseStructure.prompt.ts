/** Course generation is two phases (see courseContent.controller.ts):
 * 1. Skeleton — one call over the whole source, producing just module/lesson
 *    titles + key topics. Cheap and reliable.
 * 2. Content — one call PER MODULE (not per lesson, and not one call for the
 *    whole course), each given the full source plus that module's lesson
 *    titles/topics, asked to write all of that module's lessons in depth.
 *
 * A single call asked to write detailed, code/table-preserving content for
 * every lesson in the course at once reliably produced thin, generic
 * one-paragraph lessons in testing, regardless of word-count instructions or
 * a large completion-token budget — the model was rationing effort across
 * many items. Per-lesson calls fixed the depth problem but resend the full
 * source text on every single call, which burns through a Groq token quota
 * fast on anything but a trivially short document. Per-module is the
 * middle ground: each call only has a module's handful of lessons to write
 * (not the whole course), while cutting the number of full-source resends
 * roughly in half-to-third compared to per-lesson. */

const SKELETON_SCHEMA_DESCRIPTION = `{
  "modules": [
    {
      "title": "string — the module's name",
      "lessons": [
        {
          "title": "string — the lesson's name",
          "keyTopics": ["string", "..."]
        }
      ]
    }
  ]
}`;

export const courseSkeletonSystemPrompt = `You are planning the lesson structure for a course, based on a teacher's course document.

Read the provided course material and produce a JSON object with this exact shape:
${SKELETON_SCHEMA_DESCRIPTION}

Rules:
- Group related material into modules; each module has one or more lessons in a sensible teaching order.
- One source chapter/section is normally one lesson — don't merge multiple distinct chapters into a single lesson.
- "keyTopics" is a short list of the key terms/concepts that lesson covers.
- Do not write lesson content here — titles and key topics only.
- Respond with ONLY the JSON object. No prose, no markdown code fences, no commentary.`;

export const courseSkeletonUserPrompt = (sourceText: string): string =>
  `Course material:\n\n${sourceText}`;

export const courseSkeletonCorrectivePrompt = (invalidResponse: string): string =>
  `Your previous response was not valid JSON matching the required shape. Here is what you sent:\n\n${invalidResponse}\n\nRespond again with ONLY a JSON object matching this exact shape, and nothing else:\n${SKELETON_SCHEMA_DESCRIPTION}`;

const MODULE_CONTENT_SCHEMA_DESCRIPTION = `{
  "lessons": [
    {
      "title": "string — must exactly match one of the lesson titles given",
      "content": "string — the full teaching content for this lesson, in Markdown"
    }
  ]
}`;

export const moduleContentSystemPrompt = `You are writing the full teaching content for every lesson in ONE module of a course, based on a teacher's course document. A student must be able to learn each lesson from your content alone, without going back to the original document.

You will be told this module's lessons (title and key topics for each) and given the full course material to find their sections in. Produce a JSON object with this exact shape:
${MODULE_CONTENT_SCHEMA_DESCRIPTION}

Rules:
- Write content for every lesson listed for this module — find each one's section in the source material and write it in full depth. Ignore material that belongs to other modules.
- Each lesson's content should be at least 400 words. Cover every definition, explanation, and example the source gives for that lesson's topic — do not compress it into a short summary. A short, thin lesson is a failure condition.
- Copy the source's technical content faithfully:
  - If a lesson's source section contains any code, program listing, or command, include it reproduced verbatim (not paraphrased) in a fenced Markdown code block with a language tag, e.g. \`\`\`java ... \`\`\`.
  - If a lesson's source section contains a table, a list of Q&A pairs, or a cheat-sheet, reproduce it in full as a Markdown table (\`| col | col |\` with a header separator row) or Markdown list — every row/entry, not a shortened version.
  - Include worked examples, edge cases, and step-by-step walkthroughs the source gives for that topic.
- Use Markdown headings (##/###), bold, and bullet/numbered lists to structure each lesson the way a well-formatted lesson page would read.
- Respond with ONLY the JSON object. No prose, no markdown code fences around the JSON itself, no commentary.`;

export const moduleContentUserPrompt = (
  sourceText: string,
  moduleTitle: string,
  lessons: { title: string; keyTopics: string[] }[],
): string => {
  const lessonList = lessons
    .map((l) => `- "${l.title}" — covering: ${l.keyTopics.join(', ') || '(see source)'}`)
    .join('\n');
  return `Course material:\n\n${sourceText}\n\n---\n\nWrite full content for every lesson in the module "${moduleTitle}":\n${lessonList}`;
};

export const moduleContentCorrectivePrompt = (invalidResponse: string): string =>
  `Your previous response was not valid JSON matching the required shape. Here is what you sent:\n\n${invalidResponse}\n\nRespond again with ONLY a JSON object matching this exact shape, and nothing else:\n${MODULE_CONTENT_SCHEMA_DESCRIPTION}`;
