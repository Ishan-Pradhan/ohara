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

export const createConversation = async (
  courseId: string,
  title: string,
): Promise<TutorConversation> => {
  const res = await api.post(`/courses/${courseId}/tutor/conversations`, { title });
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
