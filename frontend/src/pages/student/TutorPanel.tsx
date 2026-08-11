import { useEffect, useRef, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { Bot, MessageCircle, Plus, Send, Sparkles, User } from 'lucide-react';

import {
  useConversations,
  useCreateConversation,
  useMessages,
  useSendMessage,
} from '../../features/tutor/useTutor.js';
import { ApiError } from '../../lib/apiError.js';
import { cn } from '../../lib/cn.js';
import { Alert } from '../../components/ui/Alert.js';
import { Card } from '../../components/ui/Card.js';
import { Badge } from '../../components/ui/Badge.js';
import { Button } from '../../components/ui/Button.js';
import { Textarea } from '../../components/ui/Textarea.js';
import { Skeleton } from '../../components/ui/Skeleton.js';
import { Spinner } from '../../components/ui/Spinner.js';
import { EmptyState } from '../../components/ui/EmptyState.js';
import { ChartRenderer } from '../../components/tutor/ChartRenderer.js';

interface TutorPanelProps {
  courseId: string;
}

export const TutorPanel = ({ courseId }: TutorPanelProps) => {
  const { data: conversations, isLoading: conversationsLoading } = useConversations(courseId);
  const createConversation = useCreateConversation(courseId);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setSelectedId(null);
  }, [courseId]);

  useEffect(() => {
    if (selectedId || !conversations || conversations.length === 0) return;
    const mostRecent = [...conversations].sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    )[0];
    setSelectedId(mostRecent.id);
  }, [conversations, selectedId]);

  const { data: messages, isLoading: messagesLoading } = useMessages(courseId, selectedId ?? '');
  const sendMessage = useSendMessage(courseId, selectedId ?? '');
  const selectedConversation = conversations?.find((conversation) => conversation.id === selectedId);

  const bottomRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [messages, sendMessage.isPending]);

  // Focus follows the conversation the moment it's ready to type into — new
  // chat, switching threads, or right after a reply comes back (the
  // textarea is never disabled, so this is the only place focus needs
  // restoring after a click moved it to the Send button).
  useEffect(() => {
    if (selectedId && !sendMessage.isPending) {
      textareaRef.current?.focus();
    }
  }, [selectedId, sendMessage.isPending]);

  const startConversation = async () => {
    try {
      const conversation = await createConversation.mutateAsync();
      setSelectedId(conversation.id);
    } catch {
      // createConversation.isError surfaces the failure below the list.
    }
  };

  const submitMessage = async () => {
    if (!draft.trim() || !selectedId || sendMessage.isPending) return;
    const content = draft.trim();
    setDraft('');
    try {
      await sendMessage.mutateAsync(content);
    } catch {
      // Put the draft back so the student doesn't lose their question — the
      // error itself is surfaced via sendMessage.isError below.
      setDraft(content);
    }
  };

  const visibleMessages = (messages ?? []).filter(
    (message) => message.type !== 'tool_call' && message.type !== 'tool_result',
  );

  return (
    <div className="grid h-[42rem] min-h-0 grid-cols-1 gap-4 md:grid-cols-[240px_1fr]">
      <Card padding="sm" className="flex min-h-0 flex-col gap-3 overflow-hidden">
        <div className="flex items-center justify-between gap-2 px-1 pt-1">
          <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-subtle">
            <MessageCircle className="size-3.5" aria-hidden />
            Conversations
          </span>
          <Button
            size="sm"
            variant="ghost"
            aria-label="New conversation"
            loading={createConversation.isPending}
            onClick={() => void startConversation()}
          >
            <Plus className="size-4" aria-hidden />
          </Button>
        </div>

        {createConversation.isError ? (
          <p className="px-1 text-xs text-danger">
            {createConversation.error instanceof ApiError
              ? createConversation.error.message
              : "Couldn't start a new conversation — try again."}
          </p>
        ) : null}

        {conversationsLoading ? (
          <div className="flex flex-col gap-2 px-1">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : !conversations || conversations.length === 0 ? (
          <p className="px-2 py-2 text-xs text-muted">
            No conversations yet — ask a question below to start one.
          </p>
        ) : (
          <div className="flex flex-col gap-1 overflow-y-auto px-1 pb-1">
            {[...conversations]
              .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
              .map((conversation) => (
                <button
                  key={conversation.id}
                  type="button"
                  onClick={() => setSelectedId(conversation.id)}
                  className={cn(
                    'flex flex-col items-start gap-0.5 rounded-control px-2.5 py-2 text-left transition-colors',
                    conversation.id === selectedId
                      ? 'bg-primary-soft text-primary'
                      : 'text-muted hover:bg-surface-hover hover:text-fg',
                  )}
                >
                  <span className="w-full truncate text-sm font-medium">{conversation.title}</span>
                  <span
                    className={cn(
                      'text-xs',
                      conversation.id === selectedId ? 'text-primary/70' : 'text-subtle',
                    )}
                  >
                    {formatDistanceToNow(new Date(conversation.updatedAt), { addSuffix: true })}
                  </span>
                </button>
              ))}
          </div>
        )}
      </Card>

      <Card padding="none" className="flex h-full min-h-0 flex-col overflow-hidden">
        {!selectedId ? (
          <div className="flex h-full items-center justify-center p-4">
            <EmptyState
              icon={Sparkles}
              title="Ask the tutor anything"
              description="Start a conversation about this course's material — your first question becomes its title."
              action={
                <Button loading={createConversation.isPending} onClick={() => void startConversation()}>
                  <Plus className="size-4" aria-hidden />
                  New conversation
                </Button>
              }
            />
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2 border-b border-border px-4 py-3">
              <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Sparkles className="size-3.5" aria-hidden />
              </div>
              <p className="min-w-0 flex-1 truncate text-sm font-semibold text-fg">
                {selectedConversation?.title ?? 'Conversation'}
              </p>
              {selectedConversation?.status === 'awaiting_student' ? (
                <Badge variant="accent">Waiting for your reply</Badge>
              ) : null}
            </div>

            <div className="flex flex-1 min-h-0 flex-col gap-4 overflow-y-auto px-4 py-4">
              {messagesLoading ? (
                <div className="flex flex-col gap-2">
                  <Skeleton className="h-12 w-2/3" />
                  <Skeleton className="ml-auto h-12 w-1/2" />
                </div>
              ) : (
                visibleMessages.map((message) => (
                  <div
                    key={message.id}
                    className={cn(
                      'flex items-end gap-2',
                      message.role === 'user' ? 'flex-row-reverse' : 'flex-row',
                    )}
                  >
                    {message.type === 'chart' && message.chart ? (
                      <ChartRenderer spec={message.chart} />
                    ) : (
                      <>
                        <div
                          className={cn(
                            'flex size-7 shrink-0 items-center justify-center rounded-full',
                            message.role === 'user' ? 'bg-muted/40 text-fg' : 'bg-primary/10 text-primary',
                          )}
                        >
                          {message.role === 'user' ? (
                            <User className="size-4" aria-hidden />
                          ) : (
                            <Bot className="size-4" aria-hidden />
                          )}
                        </div>
                        <div className="flex max-w-[78%] flex-col gap-1">
                          <div
                            className={cn(
                              'rounded-card px-3.5 py-2.5 text-sm leading-relaxed',
                              message.role === 'user'
                                ? 'bg-primary text-primary-fg'
                                : 'bg-surface-hover text-fg',
                            )}
                          >
                            {message.content}
                          </div>
                          {message.role === 'assistant' && message.sources && message.sources.length > 0 ? (
                            <details className="text-xs text-muted">
                              <summary className="cursor-pointer select-none text-subtle">Sources</summary>
                              <div className="mt-1 flex flex-wrap gap-1">
                                {message.sources.map((source) => (
                                  <Badge key={source.documentId} variant="neutral">
                                    {source.filename}
                                  </Badge>
                                ))}
                              </div>
                            </details>
                          ) : null}
                        </div>
                      </>
                    )}
                  </div>
                ))
              )}

              {sendMessage.isPending ? (
                <div className="flex items-center gap-2">
                  <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Bot className="size-4" aria-hidden />
                  </div>
                  <div className="flex items-center gap-2 rounded-card bg-surface-hover px-3.5 py-2.5 text-sm text-muted">
                    <Spinner size="sm" />
                    Thinking…
                  </div>
                </div>
              ) : null}

              <div ref={bottomRef} />
            </div>

            {sendMessage.isError ? (
              <div className="px-4">
                <Alert variant="danger">
                  {sendMessage.error instanceof ApiError
                    ? sendMessage.error.message
                    : "Couldn't send your message — try again."}
                </Alert>
              </div>
            ) : null}

            <div className="flex items-end gap-2 border-t border-border px-4 py-3">
              <Textarea
                ref={textareaRef}
                rows={2}
                placeholder="Ask a question about this course…"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    void submitMessage();
                  }
                }}
                className="flex-1"
              />
              <Button
                size="md"
                aria-label="Send message"
                disabled={!draft.trim() || sendMessage.isPending}
                loading={sendMessage.isPending}
                onClick={() => void submitMessage()}
              >
                <Send className="size-4" aria-hidden />
              </Button>
            </div>
          </>
        )}
      </Card>
    </div>
  );
};
