import type { StudentPerformanceSnapshot } from '../serializers/dashboard.serializer.js';

export const learningProfileSystemPrompt = `You are helping a student understand their academic situation from real evidence. Use only the data provided in the prompt. Do not invent grades, attendance, trends, or causes that are not supported by the evidence. Return JSON only. Keep it concise, factual, and useful.

You must produce:
- summary: 1-2 sentences describing the overall picture
- strengths: short bullet-like strings describing what the student is doing well
- attentionAreas: short bullet-like strings describing what needs attention
- nextActions: short bullet-like strings with concrete next steps
- courseInsights: one short note per course, grounded in that course's evidence

If evidence is insufficient, say that clearly and recommend collecting more evidence before drawing conclusions.`;

export const buildLearningProfileUserPrompt = (input: {
  studentName: string;
  performance: StudentPerformanceSnapshot;
}): string => {
  return `Student: ${input.studentName}

Evidence snapshot:
${JSON.stringify(input.performance, null, 2)}

Write a learning profile that reflects only this evidence.`;
};
