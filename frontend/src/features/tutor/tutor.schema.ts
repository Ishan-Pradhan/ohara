import { z } from 'zod';

/* Mirrors backend/src/validations/tutor.validation.ts and tutor.serializer.ts. */

export const lessonOutlineSchema = z.object({
  id: z.string(),
  moduleId: z.string(),
  title: z.string(),
  content: z.string(),
  keyTopics: z.array(z.string()),
  orderIndex: z.number(),
});

export const moduleOutlineSchema = z.object({
  id: z.string(),
  courseId: z.string(),
  title: z.string(),
  orderIndex: z.number(),
  lessons: z.array(lessonOutlineSchema),
});

export const tutorConversationSchema = z.object({
  id: z.string(),
  courseId: z.string(),
  studentId: z.string(),
  title: z.string(),
  status: z.enum(['active', 'awaiting_student', 'closed']),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const tutorSourceSchema = z.object({
  documentId: z.string(),
  filename: z.string(),
  chunkContent: z.string(),
});

export const chartSpecSchema = z.object({
  type: z.enum(['line', 'bar', 'scatter', 'function']),
  title: z.string(),
  xLabel: z.string(),
  yLabel: z.string(),
  series: z.array(
    z.object({
      name: z.string(),
      points: z.array(z.object({ x: z.number(), y: z.number() })),
    }),
  ),
});
export type ChartSpec = z.infer<typeof chartSpecSchema>;

export const tutorMessageSchema = z.object({
  id: z.string(),
  conversationId: z.string(),
  seq: z.number(),
  role: z.enum(['user', 'assistant', 'tool']),
  type: z.enum(['text', 'tool_call', 'tool_result', 'chart']),
  content: z.string().nullable(),
  toolCalls: z.unknown().nullable(),
  toolResult: z.unknown().nullable(),
  chart: chartSpecSchema.nullable(),
  sources: z.array(tutorSourceSchema).nullable(),
  createdAt: z.string(),
});

export const sendMessageResultSchema = z.object({
  userMessage: tutorMessageSchema,
  assistantMessage: tutorMessageSchema,
});

export type ModuleOutline = z.infer<typeof moduleOutlineSchema>;
export type TutorConversation = z.infer<typeof tutorConversationSchema>;
export type TutorMessage = z.infer<typeof tutorMessageSchema>;
export type SendMessageResult = z.infer<typeof sendMessageResultSchema>;
