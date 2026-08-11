import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  fetchCopilotConversations,
  fetchCopilotConversation,
  createCopilotConversation,
  sendCopilotMessage,
  deleteCopilotConversation,
} from './copilot.api.js';

export const copilotConversationsKey = (courseId: string) => ['copilotConversations', courseId] as const;
export const copilotConversationKey = (courseId: string, id: string) =>
  ['copilotConversation', courseId, id] as const;

export const useCopilotConversations = (courseId: string) =>
  useQuery({
    queryKey: copilotConversationsKey(courseId),
    queryFn: () => fetchCopilotConversations(courseId),
    enabled: Boolean(courseId),
  });

export const useCopilotConversation = (courseId: string, conversationId: string) =>
  useQuery({
    queryKey: copilotConversationKey(courseId, conversationId),
    queryFn: () => fetchCopilotConversation(courseId, conversationId),
    enabled: Boolean(courseId) && Boolean(conversationId),
  });

export const useCreateCopilotConversation = (courseId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => createCopilotConversation(courseId),
    onSuccess: () => qc.invalidateQueries({ queryKey: copilotConversationsKey(courseId) }),
  });
};

export const useSendCopilotMessage = (courseId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ conversationId, message }: { conversationId: string; message: string }) =>
      sendCopilotMessage(courseId, conversationId, message),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({
        queryKey: copilotConversationKey(courseId, variables.conversationId),
      });
      qc.invalidateQueries({ queryKey: copilotConversationsKey(courseId) });
    },
  });
};

export const useDeleteCopilotConversation = (courseId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (conversationId: string) => deleteCopilotConversation(courseId, conversationId),
    onSuccess: () => qc.invalidateQueries({ queryKey: copilotConversationsKey(courseId) }),
  });
};
