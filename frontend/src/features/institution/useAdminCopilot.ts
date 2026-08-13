import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  fetchAdminCopilotConversations,
  fetchAdminCopilotConversation,
  createAdminCopilotConversation,
  sendAdminCopilotMessage,
  deleteAdminCopilotConversation,
} from './adminCopilot.api.js';

export const adminCopilotConversationsKey = ['adminCopilotConversations'] as const;
export const adminCopilotConversationKey = (id: string) => ['adminCopilotConversation', id] as const;

export const useAdminCopilotConversations = () =>
  useQuery({
    queryKey: adminCopilotConversationsKey,
    queryFn: fetchAdminCopilotConversations,
  });

export const useAdminCopilotConversation = (conversationId: string) =>
  useQuery({
    queryKey: adminCopilotConversationKey(conversationId),
    queryFn: () => fetchAdminCopilotConversation(conversationId),
    enabled: Boolean(conversationId),
  });

export const useCreateAdminCopilotConversation = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createAdminCopilotConversation,
    onSuccess: () => qc.invalidateQueries({ queryKey: adminCopilotConversationsKey }),
  });
};

export const useSendAdminCopilotMessage = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ conversationId, message }: { conversationId: string; message: string }) =>
      sendAdminCopilotMessage(conversationId, message),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: adminCopilotConversationKey(variables.conversationId) });
      qc.invalidateQueries({ queryKey: adminCopilotConversationsKey });
    },
  });
};

export const useDeleteAdminCopilotConversation = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteAdminCopilotConversation,
    onSuccess: () => qc.invalidateQueries({ queryKey: adminCopilotConversationsKey }),
  });
};
