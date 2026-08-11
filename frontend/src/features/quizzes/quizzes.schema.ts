import { z } from 'zod';

export const questionSchema = z.object({
  id: z.string(),
  quizId: z.string(),
  type: z.enum(['mcq', 'short_answer']),
  prompt: z.string(),
  options: z.array(z.string()).nullable(),
  correctIndex: z.number().nullable().optional(),
  points: z.number(),
  orderIndex: z.number(),
  difficulty: z.enum(['easy', 'medium', 'hard']).nullable().optional(),
  cognitiveLevel: z.enum(['remember', 'understand', 'apply', 'analyze', 'evaluate', 'create']).nullable().optional(),
});

export const quizSchema = z.object({
  id: z.string(),
  courseId: z.string(),
  title: z.string(),
  status: z.enum(['draft', 'published']),
  createdAt: z.string(),
  questions: z.array(questionSchema).optional(),
});

export const generateQuizSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  lessonId: z.string().optional(),
  lessonIds: z.array(z.string()).min(1).optional(),
  topic: z.string().optional(),
  numQuestions: z.number().int().min(1).max(20),
  types: z.array(z.enum(['mcq', 'short_answer'])).min(1),
  difficulty: z.enum(['easy', 'medium', 'hard', 'mixed']).optional(),
  cognitiveDistribution: z
    .object({
      remember: z.number().int().min(0).optional(),
      understand: z.number().int().min(0).optional(),
      apply: z.number().int().min(0).optional(),
      analyze: z.number().int().min(0).optional(),
      evaluate: z.number().int().min(0).optional(),
      create: z.number().int().min(0).optional(),
    })
    .optional(),
  pointsPerQuestion: z.number().int().min(1).max(100).optional(),
  learningObjectives: z.array(z.string().min(1)).min(1).optional(),
});

export const createQuizSchema = z.object({
  title: z.string().min(1, 'Title is required'),
});

const mcqFields = {
  type: z.literal('mcq'),
  prompt: z.string().min(1, 'Prompt is required'),
  options: z
    .array(z.object({ value: z.string().min(1, 'Option cannot be empty') }))
    .min(2, 'At least 2 options')
    .max(6, 'At most 6 options'),
  correctIndex: z.number().int().min(0),
  points: z.number().int().positive(),
};

const shortAnswerFields = {
  type: z.literal('short_answer'),
  prompt: z.string().min(1, 'Prompt is required'),
  points: z.number().int().positive(),
};

/** Form-shape schema (options as {value} objects for react-hook-form's
 * useFieldArray, which needs object rows, not plain strings) — mapped to the
 * wire shape (string[]) only at submit. */
export const questionFormSchema = z.discriminatedUnion('type', [
  z.object(mcqFields),
  z.object(shortAnswerFields),
]);

// Wire shape for question create/update — distinct from questionFormSchema,
// whose mcq options are {value} rows for useFieldArray.
export type CreateQuestionInput =
  | { type: 'mcq'; prompt: string; options: string[]; correctIndex: number; points: number; orderIndex: number }
  | { type: 'short_answer'; prompt: string; points: number; orderIndex: number };

export interface UpdateQuestionInput {
  prompt?: string;
  options?: string[];
  correctIndex?: number;
  points?: number;
  orderIndex?: number;
}

export type Question = z.infer<typeof questionSchema>;
export type Quiz = z.infer<typeof quizSchema>;
export type GenerateQuizInput = z.infer<typeof generateQuizSchema>;
export type CreateQuizInput = z.infer<typeof createQuizSchema>;
export type QuestionFormInput = z.infer<typeof questionFormSchema>;

export const shortAnswerGradeStatusSchema = z.enum(['ungraded', 'draft', 'approved']);

export const attemptResultSchema = z.object({
  questionId: z.string(),
  type: z.enum(['mcq', 'short_answer']).nullable(),
  answer: z.union([z.number(), z.string()]),
  correct: z.boolean().nullable(),
  correctIndex: z.number().nullable().optional(),
  points: z.number(),
  grade: z
    .object({
      status: shortAnswerGradeStatusSchema,
      awardedPoints: z.number().nullable(),
      maxPoints: z.number().nullable(),
      feedback: z.string().nullable(),
    })
    .nullable(),
});

export const shortAnswerGradeSchema = z.object({
  id: z.string(),
  questionId: z.string(),
  awardedPoints: z.number(),
  maxPoints: z.number(),
  feedback: z.string().nullable(),
  status: z.enum(['draft', 'approved']),
});

export const quizAttemptSchema = z.object({
  id: z.string(),
  quizId: z.string(),
  studentId: z.string(),
  student: z.object({ id: z.string(), name: z.string(), email: z.string() }).optional(),
  score: z.number(),
  maxScore: z.number(),
  submittedAt: z.string(),
  results: z.array(attemptResultSchema),
});

export type QuizAttempt = z.infer<typeof quizAttemptSchema>;
export type AttemptResult = z.infer<typeof attemptResultSchema>;
export type ShortAnswerGrade = z.infer<typeof shortAnswerGradeSchema>;
