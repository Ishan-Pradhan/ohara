import { z } from 'zod';

export const courseIdParamSchema = {
  params: z.object({ courseId: z.uuid() }),
};

// title is optional — a new conversation starts as "New conversation" and is
// retitled from the student's first message (ChatGPT-style), so the student
// never has to name it themselves.
export const createConversationSchema = {
  params: z.object({ courseId: z.uuid() }),
  body: z.object({ title: z.string().min(1).optional() }),
};

export const listMessagesSchema = {
  params: z.object({ courseId: z.uuid(), conversationId: z.uuid() }),
};

export const sendMessageSchema = {
  params: z.object({ courseId: z.uuid(), conversationId: z.uuid() }),
  body: z.object({ content: z.string().min(1, 'Message cannot be empty') }),
};

export const deleteConversationSchema = {
  params: z.object({ courseId: z.uuid(), conversationId: z.uuid() }),
};

export const deleteMessageSchema = {
  params: z.object({ courseId: z.uuid(), conversationId: z.uuid(), messageId: z.uuid() }),
};
