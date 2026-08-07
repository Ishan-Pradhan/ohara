import type { CourseConceptEvidence } from '../repositories/conceptEvidence.repository.js';

/**
 * System prompt for concept mastery AI interpretation.
 * Called when a student has courses in the 'needs_attention' state and there
 * is enough quiz evidence to comment on them meaningfully.
 */
export const conceptMasterySystemPrompt = `You are helping a student understand which academic concepts may need more attention, based on their quiz performance in each course. The evidence is indirect: quiz scores are available at the course level, not per topic. Be honest about this limitation. Use only the data provided. Do not invent grades, scores, or topic-level details that are not in the evidence.

Return JSON only with this exact structure:
{
  "highlights": string[],      // 1-3 concise phrases about where the student is doing well
  "attentionTopics": string[], // 1-3 specific topic names from the weak courses that the student should revisit
  "suggestion": string         // 1-2 sentences: a concrete, actionable study suggestion
}

If there are no weak areas, say so clearly in "highlights" and return empty arrays for the others.
If evidence is insufficient, say so in "suggestion" and return empty arrays.`;

/** Builds the user prompt summarising the raw course evidence for AI interpretation. */
export const buildConceptMasteryUserPrompt = (
  studentName: string,
  courseEvidence: CourseConceptEvidence[],
): string => {
  const courseLines = courseEvidence.map((course) => {
    const evidence = course.quizAttempt.attemptedCount > 0
      ? `quiz average: ${course.quizAttempt.averageScorePercentage?.toFixed(1) ?? 'n/a'}% (${course.quizAttempt.attemptedCount}/${course.quizAttempt.quizCount} quizzes attempted)`
      : 'no quiz attempts yet';

    const topics =
      course.topics.length > 0
        ? course.topics.slice(0, 10).join(', ')
        : 'no topics defined';

    return `- ${course.courseTitle}: ${evidence} | topics: ${topics}`;
  }).join('\n');

  return `Student: ${studentName}

Concept inventory:
${courseLines}

Note: quiz performance is at the course level — there is no per-topic score available. Topic names come from lesson content.

Identify where the student needs attention and provide actionable guidance.`;
};
