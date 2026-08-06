import { z } from 'zod';

export const rubricCriterionSchema = z.object({
  criterion: z.string().min(1, 'Criterion is required'),
  maxPoints: z.number().positive('Must be greater than 0'),
  description: z.string().optional(),
});

export const assignmentSchema = z.object({
  id: z.string(),
  courseId: z.string(),
  title: z.string(),
  prompt: z.string(),
  rubric: z.array(rubricCriterionSchema),
  dueAt: z.string(),
  createdAt: z.string(),
});

export const createAssignmentSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  prompt: z.string().min(1, 'Prompt is required'),
  rubric: z.array(rubricCriterionSchema).min(1, 'Add at least one rubric criterion'),
  dueAt: z.string().min(1, 'Due date is required'),
});

export const criterionFeedbackSchema = z.object({
  criterion: z.string(),
  maxPoints: z.number(),
  awardedPoints: z.number(),
  feedback: z.string(),
});

export const gradeSchema = z.object({
  id: z.string(),
  submissionId: z.string(),
  score: z.number(),
  criterionFeedback: z.array(criterionFeedbackSchema),
  overallFeedback: z.string().nullable(),
  status: z.enum(['draft', 'approved']),
  approvedBy: z.string().nullable(),
  createdAt: z.string(),
});

export const submissionSchema = z.object({
  id: z.string(),
  assignmentId: z.string(),
  studentId: z.string(),
  student: z.object({ id: z.string(), name: z.string(), email: z.string() }).optional(),
  content: z.string().nullable(),
  fileUrl: z.string().nullable(),
  fileOriginalName: z.string().nullable(),
  isLate: z.boolean(),
  submittedAt: z.string(),
  createdAt: z.string(),
  grade: gradeSchema.nullable().optional(),
});

export type RubricCriterion = z.infer<typeof rubricCriterionSchema>;
export type Assignment = z.infer<typeof assignmentSchema>;
export type CreateAssignmentInput = z.infer<typeof createAssignmentSchema>;
export type CriterionFeedback = z.infer<typeof criterionFeedbackSchema>;
export type Grade = z.infer<typeof gradeSchema>;
export type Submission = z.infer<typeof submissionSchema>;
