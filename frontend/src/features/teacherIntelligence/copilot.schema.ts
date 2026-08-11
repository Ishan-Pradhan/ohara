import { z } from 'zod';

export const copilotMessageSchema = z.object({
  id: z.string(),
  seq: z.number(),
  role: z.enum(['user', 'assistant']),
  content: z.string(),
  createdAt: z.string(),
});

export const copilotConversationSchema = z.object({
  id: z.string(),
  courseId: z.string(),
  title: z.string(),
  status: z.enum(['active', 'closed']),
  createdAt: z.string(),
});

export const copilotConversationDetailSchema = copilotConversationSchema.extend({
  messages: z.array(copilotMessageSchema),
});

export type CopilotMessage = z.infer<typeof copilotMessageSchema>;
export type CopilotConversation = z.infer<typeof copilotConversationSchema>;
export type CopilotConversationDetail = z.infer<typeof copilotConversationDetailSchema>;
