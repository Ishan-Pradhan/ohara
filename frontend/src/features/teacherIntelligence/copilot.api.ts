import { z } from 'zod';
import { api } from '../../lib/axios.js';
import {
  copilotConversationSchema,
  copilotConversationDetailSchema,
  type CopilotConversation,
  type CopilotConversationDetail,
} from './copilot.schema.js';

export const fetchCopilotConversations = async (courseId: string): Promise<CopilotConversation[]> => {
  const res = await api.get(`/courses/${courseId}/copilot/conversations`);
  return z.array(copilotConversationSchema).parse(res.data.data);
};

export const fetchCopilotConversation = async (
  courseId: string,
  conversationId: string,
): Promise<CopilotConversationDetail> => {
  const res = await api.get(`/courses/${courseId}/copilot/conversations/${conversationId}`);
  return copilotConversationDetailSchema.parse(res.data.data);
};

export const createCopilotConversation = async (courseId: string): Promise<CopilotConversation> => {
  const res = await api.post(`/courses/${courseId}/copilot/conversations`);
  return copilotConversationSchema.parse(res.data.data);
};

export const sendCopilotMessage = async (
  courseId: string,
  conversationId: string,
  message: string,
): Promise<{ userMessage: { id: string }; assistantMessage: { id: string; content: string } }> => {
  const res = await api.post(`/courses/${courseId}/copilot/conversations/${conversationId}/messages`, {
    message,
  });
  return res.data.data;
};

export const deleteCopilotConversation = async (courseId: string, conversationId: string): Promise<void> => {
  await api.delete(`/courses/${courseId}/copilot/conversations/${conversationId}`);
};
