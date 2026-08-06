import type { RubricCriterion } from '../types/assignments.types.js';

const SCHEMA_DESCRIPTION = `{
  "criterionFeedback": [
    {
      "criterion": "string — must exactly match one of the rubric criteria given",
      "awardedPoints": "number — between 0 and that criterion's maxPoints",
      "feedback": "string — a sentence or two explaining the score for this criterion"
    }
  ],
  "overallFeedback": "string — a short overall comment on the submission"
}`;

const formatRubric = (rubric: RubricCriterion[]): string =>
  rubric
    .map(
      (c) =>
        `- ${c.criterion} (max ${c.maxPoints} points)${c.description ? `: ${c.description}` : ''}`,
    )
    .join('\n');

export const gradingSystemPrompt = `You are grading a student's assignment submission against a teacher-provided rubric.

Read the assignment prompt, the rubric, and the student's submission. Produce a JSON object with this exact shape:
${SCHEMA_DESCRIPTION}

Rules:
- Include exactly one entry in "criterionFeedback" per rubric criterion, in the same order as given.
- "awardedPoints" must never exceed that criterion's maxPoints, and must be a plain number (not a string).
- Be specific and constructive — feedback should reference the actual submission content, not generic praise.
- This is a DRAFT grade a teacher will review before it's ever shown to the student — grade fairly and honestly against the rubric.
- Respond with ONLY the JSON object. No prose, no markdown code fences, no commentary.`;

export const gradingUserPrompt = (
  assignmentPrompt: string,
  rubric: RubricCriterion[],
  submissionText: string,
): string =>
  `Assignment prompt:\n${assignmentPrompt}\n\nRubric:\n${formatRubric(rubric)}\n\nStudent submission:\n${submissionText}`;

export const gradingCorrectivePrompt = (invalidResponse: string): string =>
  `Your previous response was not valid JSON matching the required shape. Here is what you sent:\n\n${invalidResponse}\n\nRespond again with ONLY a JSON object matching this exact shape, and nothing else:\n${SCHEMA_DESCRIPTION}`;
