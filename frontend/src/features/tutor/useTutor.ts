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
import type { TutorMessage } from './tutor.schema.js';

/** Id prefix for the optimistic bubble useSendMessage appends immediately on
 * submit — TutorPanel.tsx uses this to keep it non-deletable while the real
 * row doesn't exist yet. */
export const OPTIMISTIC_MESSAGE_ID_PREFIX = 'optimistic-';

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
  const key = messagesKey(courseId, conversationId);
  return useMutation({
    mutationFn: (content: string) => sendMessage(courseId, conversationId, content),
    // The request doesn't resolve until the whole tutor turn finishes (agent
    // loop, tool calls, the LLM call itself) — without this, the student's
    // own message wouldn't appear anywhere until that full round-trip
    // completes, reading as "my message didn't send." Append it immediately;
    // onSuccess's invalidate below replaces it with the real persisted row.
    onMutate: async (content: string) => {
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<TutorMessage[]>(key);
      const optimisticMessage: TutorMessage = {
        id: `${OPTIMISTIC_MESSAGE_ID_PREFIX}${Date.now()}`,
        conversationId,
        seq: (previous?.at(-1)?.seq ?? -1) + 1,
        role: 'user',
        type: 'text',
        content,
        toolCalls: null,
        toolResult: null,
        chart: null,
        sources: null,
        createdAt: new Date().toISOString(),
      };
      qc.setQueryData<TutorMessage[]>(key, (old) => [...(old ?? []), optimisticMessage]);
      return { previous };
    },
    onError: (_err, _content, context) => {
      if (context?.previous) {
        qc.setQueryData(key, context.previous);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: key });
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
