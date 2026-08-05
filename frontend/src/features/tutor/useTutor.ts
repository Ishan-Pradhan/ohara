import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  fetchOutline,
  fetchConversations,
  createConversation,
  fetchMessages,
  sendMessage,
} from './tutor.api.js';

export const useOutline = (courseId: string) =>
  useQuery({
    queryKey: ['tutor', 'outline', courseId],
    queryFn: () => fetchOutline(courseId),
    enabled: Boolean(courseId),
  });

export const conversationsKey = (courseId: string) => ['tutor', 'conversations', courseId] as const;

export const useConversations = (courseId: string) =>
  useQuery({
    queryKey: conversationsKey(courseId),
    queryFn: () => fetchConversations(courseId),
    enabled: Boolean(courseId),
  });

export const useCreateConversation = (courseId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (title: string) => createConversation(courseId, title),
    onSuccess: () => qc.invalidateQueries({ queryKey: conversationsKey(courseId) }),
  });
};

export const messagesKey = (courseId: string, conversationId: string) =>
  ['tutor', 'messages', courseId, conversationId] as const;

export const useMessages = (courseId: string, conversationId: string) =>
  useQuery({
    queryKey: messagesKey(courseId, conversationId),
    queryFn: () => fetchMessages(courseId, conversationId),
    enabled: Boolean(courseId) && Boolean(conversationId),
  });

export const useSendMessage = (courseId: string, conversationId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (content: string) => sendMessage(courseId, conversationId, content),
    onSuccess: () => qc.invalidateQueries({ queryKey: messagesKey(courseId, conversationId) }),
  });
};
