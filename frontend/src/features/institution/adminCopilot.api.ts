import { z } from 'zod';
import { api } from '../../lib/axios.js';
import {
  adminCopilotConversationSchema,
  adminCopilotConversationDetailSchema,
  type AdminCopilotConversation,
  type AdminCopilotConversationDetail,
} from './adminCopilot.schema.js';

export const fetchAdminCopilotConversations = async (): Promise<AdminCopilotConversation[]> => {
  const res = await api.get('/admin/copilot/conversations');
  return z.array(adminCopilotConversationSchema).parse(res.data.data);
};

export const fetchAdminCopilotConversation = async (
  conversationId: string,
): Promise<AdminCopilotConversationDetail> => {
  const res = await api.get(`/admin/copilot/conversations/${conversationId}`);
  return adminCopilotConversationDetailSchema.parse(res.data.data);
};

export const createAdminCopilotConversation = async (): Promise<AdminCopilotConversation> => {
  const res = await api.post('/admin/copilot/conversations');
  return adminCopilotConversationSchema.parse(res.data.data);
};

export const sendAdminCopilotMessage = async (
  conversationId: string,
  message: string,
): Promise<{ userMessage: { id: string }; assistantMessage: { id: string; content: string } }> => {
  const res = await api.post(`/admin/copilot/conversations/${conversationId}/messages`, { message });
  return res.data.data;
};

export const deleteAdminCopilotConversation = async (conversationId: string): Promise<void> => {
  await api.delete(`/admin/copilot/conversations/${conversationId}`);
};
