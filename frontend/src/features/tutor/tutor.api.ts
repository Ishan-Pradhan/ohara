import { z } from 'zod';

import { api } from '../../lib/axios.js';
import {
  moduleOutlineSchema,
  tutorConversationSchema,
  tutorMessageSchema,
  sendMessageResultSchema,
  type ModuleOutline,
  type TutorConversation,
  type TutorMessage,
  type SendMessageResult,
} from './tutor.schema.js';

export const fetchOutline = async (courseId: string): Promise<ModuleOutline[]> => {
  const res = await api.get(`/courses/${courseId}/outline`);
  return z.array(moduleOutlineSchema).parse(res.data.data);
};

export const fetchConversations = async (courseId: string): Promise<TutorConversation[]> => {
  const res = await api.get(`/courses/${courseId}/tutor/conversations`);
  return z.array(tutorConversationSchema).parse(res.data.data);
};

export const createConversation = async (courseId: string): Promise<TutorConversation> => {
  const res = await api.post(`/courses/${courseId}/tutor/conversations`, {});
  return tutorConversationSchema.parse(res.data.data);
};

export const fetchMessages = async (
  courseId: string,
  conversationId: string,
): Promise<TutorMessage[]> => {
  const res = await api.get(`/courses/${courseId}/tutor/conversations/${conversationId}/messages`);
  return z.array(tutorMessageSchema).parse(res.data.data);
};

export const sendMessage = async (
  courseId: string,
  conversationId: string,
  content: string,
): Promise<SendMessageResult> => {
  const res = await api.post(
    `/courses/${courseId}/tutor/conversations/${conversationId}/messages`,
    { content },
  );
  return sendMessageResultSchema.parse(res.data.data);
};

export const deleteConversation = async (courseId: string, conversationId: string): Promise<void> => {
  await api.delete(`/courses/${courseId}/tutor/conversations/${conversationId}`);
};

/** Only the most recent message in a conversation can be deleted — see
 * backend/src/repositories/tutorMessages.repository.ts's isLatest. */
export const deleteMessage = async (
  courseId: string,
  conversationId: string,
  messageId: string,
): Promise<void> => {
  await api.delete(`/courses/${courseId}/tutor/conversations/${conversationId}/messages/${messageId}`);
};
