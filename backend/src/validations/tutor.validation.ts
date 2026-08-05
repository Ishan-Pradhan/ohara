import { z } from 'zod';

export const courseIdParamSchema = {
  params: z.object({ courseId: z.uuid() }),
};

export const createConversationSchema = {
  params: z.object({ courseId: z.uuid() }),
  body: z.object({ title: z.string().min(1, 'Title is required') }),
};

export const listMessagesSchema = {
  params: z.object({ courseId: z.uuid(), conversationId: z.uuid() }),
};

export const sendMessageSchema = {
  params: z.object({ courseId: z.uuid(), conversationId: z.uuid() }),
  body: z.object({ content: z.string().min(1, 'Message cannot be empty') }),
};
