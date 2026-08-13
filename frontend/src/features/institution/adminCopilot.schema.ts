import { z } from 'zod';

export const adminCopilotMessageSchema = z.object({
  id: z.string(),
  seq: z.number(),
  role: z.enum(['user', 'assistant']),
  content: z.string(),
  createdAt: z.string(),
});

export const adminCopilotConversationSchema = z.object({
  id: z.string(),
  title: z.string(),
  status: z.enum(['active', 'closed']),
  createdAt: z.string(),
});

export const adminCopilotConversationDetailSchema = adminCopilotConversationSchema.extend({
  messages: z.array(adminCopilotMessageSchema),
});

export type AdminCopilotMessage = z.infer<typeof adminCopilotMessageSchema>;
export type AdminCopilotConversation = z.infer<typeof adminCopilotConversationSchema>;
export type AdminCopilotConversationDetail = z.infer<typeof adminCopilotConversationDetailSchema>;
