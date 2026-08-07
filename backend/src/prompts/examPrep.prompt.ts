/**
 * Prompts for the Exam Preparation Mode (Slice 8).
 *
 * Safety constraints:
 * - The LLM explains evidence; it never assigns, modifies, or invents grades.
 * - All numeric values (scores, percentages, counts) come from the backend.
 * - The output is a prose explanation + structured recommendation list,
 *   Zod-validated before being returned to the client.
 */

import type { ExamPrepEvidence } from '../repositories/examPrep.repository.js';
import type { ReadinessState } from '../serializers/examPrep.serializer.js';

export const examPrepSystemPrompt = `You are an academic preparation coach. You receive a student's performance evidence for a specific assessment and produce a concise readiness report in JSON.

Rules:
- Output ONLY valid JSON. No explanation, no markdown.
- Base ALL claims on the provided evidence — do not invent grades, scores, or test results.
- Be honest: if evidence shows the student is underprepared, say so clearly but constructively.
- Keep the explanation under 4 sentences.
- Return between 2 and 5 specific, actionable recommendations grounded in the evidence.
- Do not fabricate topic names, question content, or rubric criteria not present in the input.`;

export interface ExamPrepPromptInput {
  studentName: string;
  assessmentType: 'quiz' | 'assignment';
  assessmentTitle: string;
  courseTitle: string;
  readinessState: ReadinessState;
  readinessScore: number | null;
  evidence: ExamPrepEvidence;
}

export const buildExamPrepUserPrompt = (input: ExamPrepPromptInput): string => {
  const lines: string[] = [
    `Generate a readiness report for ${input.studentName} preparing for the following assessment.`,
    '',
    'ASSESSMENT:',
    `  Type: ${input.assessmentType}`,
    `  Title: ${input.assessmentTitle}`,
    `  Course: ${input.courseTitle}`,
    `  Readiness state: ${input.readinessState}`,
    `  Readiness score: ${input.readinessScore !== null ? `${input.readinessScore.toFixed(1)}%` : 'no prior data'}`,
    '',
  ];

  if (input.assessmentType === 'quiz') {
    const ev = input.evidence as Extract<ExamPrepEvidence, { assessmentType: 'quiz' }>;

    lines.push('QUIZ EVIDENCE:');
    lines.push(`  Total questions: ${ev.totalQuestions}`);
    lines.push(
      `  Course-level MCQ correct rate: ${ev.mcqCorrectRate !== null ? `${ev.mcqCorrectRate.toFixed(1)}%` : 'no quiz attempts yet'}`,
    );
    lines.push(
      `  Already attempted this quiz: ${ev.alreadyAttempted ? `yes (score: ${ev.attemptScore !== null ? ev.attemptScore.toFixed(1) + '%' : 'pending'})` : 'no'}`,
    );

    const weakQuestions = ev.questionBreakdown.filter((q) => q.lastAnswerCorrect === false);
    if (weakQuestions.length > 0) {
      lines.push('');
      lines.push(`  Incorrect answers in prior attempt (${weakQuestions.length}):`)
      for (const q of weakQuestions.slice(0, 5)) {
        lines.push(`    - "${q.prompt}"`);
      }
      if (weakQuestions.length > 5) {
        lines.push(`    ... and ${weakQuestions.length - 5} more`);
      }
    }

    if (ev.weakTopics.length > 0) {
      lines.push('');
      lines.push('  Weak concept topics from course lessons:');
      for (const topic of ev.weakTopics) {
        lines.push(`    - ${topic}`);
      }
    }
  } else {
    const ev = input.evidence as Extract<ExamPrepEvidence, { assessmentType: 'assignment' }>;

    lines.push('ASSIGNMENT EVIDENCE:');
    lines.push(
      `  Already submitted: ${ev.alreadySubmitted ? `yes (grade: ${ev.gradeScore !== null ? ev.gradeScore.toFixed(1) + '%' : 'not yet graded'})` : 'no'}`,
    );
    lines.push(
      `  Course completion rate: ${ev.completionRate !== null ? `${ev.completionRate.toFixed(1)}%` : 'no data'}`,
    );

    if (ev.weakCriteria.length > 0) {
      lines.push('');
      lines.push('  Rubric criteria and historical performance:');
      for (const c of ev.weakCriteria) {
        const rateStr =
          c.historicalScoreRate !== null
            ? `${(c.historicalScoreRate * 100).toFixed(1)}% historically`
            : 'no history';
        lines.push(`    - ${c.criterion}: ${rateStr}`);
      }
    }
  }

  lines.push('');
  lines.push('Return JSON with this exact structure:');
  lines.push(`{
  "explanation": "<2–4 sentences explaining the student's readiness and key evidence>",
  "recommendations": [
    "<specific, actionable step the student should take before this assessment>",
    "<another step>",
    "<optional: 1–3 more steps>"
  ]
}`);

  return lines.join('\n');
};
