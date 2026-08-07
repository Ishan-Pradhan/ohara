import { z } from 'zod';

export const examPrepAIOutputSchema = z.object({
  explanation: z.string(),
  recommendations: z.array(z.string()),
});

export const examPrepResponseSchema = z.object({
  assessmentType: z.enum(['quiz', 'assignment']),
  assessmentId: z.string(),
  assessmentTitle: z.string(),
  courseId: z.string(),
  courseTitle: z.string(),
  readinessScore: z.number().nullable(),
  readinessState: z.enum(['ready', 'developing', 'needs_attention', 'insufficient_data']),
  weakAreas: z.array(z.string()),
  alreadyCompleted: z.boolean(),
  ai: examPrepAIOutputSchema.nullable(),
  evidence: z.record(z.string(), z.unknown()),
});

export type ExamPrepAIOutput = z.infer<typeof examPrepAIOutputSchema>;
export type ExamPrepResponse = z.infer<typeof examPrepResponseSchema>;
export type ReadinessState = ExamPrepResponse['readinessState'];
