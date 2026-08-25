/** Course generation is two phases (see courseContent.controller.ts):
 * 1. Skeleton — one call over the whole source, producing just module/lesson
 *    titles + key topics. Truncated to COURSE_SKELETON_MAX_SOURCE_CHARS
 *    (constants/index.ts) rather than the far larger MAX_LLM_SOURCE_CHARS —
 *    unlike module content below, this phase can't use RAG retrieval to stay
 *    under Groq's TPM ceiling, so a big-enough document still only gets a
 *    structure generated from its first ~15,000 characters, not the whole
 *    thing. Known limitation, not solved here — see the module content note
 *    below for why this phase can't use the same retrieval fix.
 *
 *    Two prompt variants for this call, chosen by whether the course has a
 *    Course.syllabusDocumentId set: courseSkeletonSystemPrompt INVENTS a
 *    grouping from whatever document generateCourseStructure was pointed
 *    at; courseSkeletonFromSyllabusSystemPrompt EXTRACTS the structure an
 *    official syllabus document already defines, instead. The latter exists
 *    because inventing a "sensible" structure from a textbook produces a
 *    course structure that may not match a university's mandated syllabus —
 *    which the teacher is required to teach to regardless of how the
 *    source material happens to be organized.
 * 2. Content — one call PER MODULE (not per lesson, and not one call for the
 *    whole course), given that module's lesson titles/topics plus source
 *    material RAG-retrieved for those lessons (documentChunkRepository, via
 *    resolveModuleSourceText in courseContent.controller.ts) — not the full
 *    document.
 *
 * A single call asked to write detailed, code/table-preserving content for
 * every lesson in the course at once reliably produced thin, generic
 * one-paragraph lessons in testing, regardless of word-count instructions or
 * a large completion-token budget — the model was rationing effort across
 * many items. Per-lesson calls fixed the depth problem but resent the whole
 * document on every single call. Per-module is the middle ground on call
 * count (a module's handful of lessons per call, not the whole course); RAG
 * retrieval is the fix for what each of those calls sends as source material
 * — the module-content call reliably exceeded Groq's on_demand tier's
 * TPM per-request cap once resending the whole document, regardless
 * of chunking calls by module or by lesson. The skeleton call can't use the
 * same retrieval fix — it needs a global view of the document to find
 * sensible module/lesson boundaries in the first place, before any
 * per-module query exists to search with. */

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

/** Used instead of courseSkeletonSystemPrompt when the course has a
 * Course.syllabusDocumentId set (see generateSkeleton, courseContent.controller.ts).
 * A deliberately different task from the "invent a sensible grouping"
 * prompt above: an official syllabus already states its own units/topics —
 * the model's job is to transcribe that structure faithfully, not redesign
 * it. Written for the case that matters most in practice: many university
 * programs (this one is built for Nepali bachelor's courses specifically)
 * run against a fixed, institution-mandated syllabus that a teacher is
 * required to follow — inventing a different grouping from a textbook's own
 * organization, even a reasonable one, would teach the wrong curriculum. */
export const courseSkeletonFromSyllabusSystemPrompt = `You are extracting the official module/lesson structure from a university course syllabus, so a teacher can generate lesson content against it later.

Read the provided syllabus and produce a JSON object with this exact shape:
${SKELETON_SCHEMA_DESCRIPTION}

Rules:
- This is a TRANSCRIPTION task, not a design task: the syllabus already defines the official units and topics. Do not invent, merge, split, reorder, or rebalance them — follow the syllabus's own structure and wording as closely as possible.
- Each syllabus unit/chapter becomes one module, in the order the syllabus lists them. If the syllabus breaks a unit into named sub-topics or sessions, each becomes one lesson within that module, in the syllabus's own order.
- If the syllabus lists topics for a unit but doesn't split it into named sub-topics, put the whole unit as a single lesson and use its listed topics as "keyTopics".
- "keyTopics" must be terms the syllabus itself lists or names for that lesson — do not add topics the syllabus doesn't mention.
- Do not write lesson content here — titles and key topics only.
- Respond with ONLY the JSON object. No prose, no markdown code fences, no commentary.`;

export const courseSkeletonFromSyllabusUserPrompt = (syllabusText: string): string =>
  `Official syllabus:\n\n${syllabusText}`;

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
