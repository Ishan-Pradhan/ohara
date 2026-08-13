import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  fetchOutline,
  fetchConversations,
  createConversation,
  fetchMessages,
  sendMessage,
  deleteConversation,
  deleteMessage,
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
    mutationFn: () => createConversation(courseId),
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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: messagesKey(courseId, conversationId) });
      // A message can flip the conversation's status (ask_student sets
      // awaiting_student; a student reply resumes it back to active) — the
      // "Waiting for your reply" badge in TutorPanel.tsx reads status from
      // this list query, so it must be invalidated here too, same as
      // useCreateConversation above.
      qc.invalidateQueries({ queryKey: conversationsKey(courseId) });
    },
  });
};

export const useDeleteConversation = (courseId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (conversationId: string) => deleteConversation(courseId, conversationId),
    onSuccess: () => qc.invalidateQueries({ queryKey: conversationsKey(courseId) }),
  });
};

/** Only the most recent message in a conversation can be deleted — the
 * backend enforces this and 400s otherwise (see tutor.api.ts). */
export const useDeleteMessage = (courseId: string, conversationId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (messageId: string) => deleteMessage(courseId, conversationId, messageId),
    onSuccess: () => qc.invalidateQueries({ queryKey: messagesKey(courseId, conversationId) }),
  });
};
