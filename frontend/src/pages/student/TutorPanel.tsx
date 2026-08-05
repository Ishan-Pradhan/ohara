import { useEffect, useState } from 'react';
import { MessageCircle, Plus, Send } from 'lucide-react';

import {
  useConversations,
  useCreateConversation,
  useMessages,
  useSendMessage,
} from '../../features/tutor/useTutor.js';
import { cn } from '../../lib/cn.js';
import { Card } from '../../components/ui/Card.js';
import { Badge } from '../../components/ui/Badge.js';
import { Button } from '../../components/ui/Button.js';
import { Input } from '../../components/ui/Input.js';
import { Textarea } from '../../components/ui/Textarea.js';
import { Skeleton } from '../../components/ui/Skeleton.js';
import { Spinner } from '../../components/ui/Spinner.js';
import { EmptyState } from '../../components/ui/EmptyState.js';

interface TutorPanelProps {
  courseId: string;
}

export const TutorPanel = ({ courseId }: TutorPanelProps) => {
  const { data: conversations, isLoading: conversationsLoading } = useConversations(courseId);
  const createConversation = useCreateConversation(courseId);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [draft, setDraft] = useState('');

  useEffect(() => {
    if (selectedId || !conversations || conversations.length === 0) return;
    const mostRecent = [...conversations].sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    )[0];
    setSelectedId(mostRecent.id);
  }, [conversations, selectedId]);

  const { data: messages, isLoading: messagesLoading } = useMessages(courseId, selectedId ?? '');
  const sendMessage = useSendMessage(courseId, selectedId ?? '');

  const startConversation = async () => {
    if (!newTitle.trim()) return;
    const conversation = await createConversation.mutateAsync(newTitle.trim());
    setSelectedId(conversation.id);
    setNewTitle('');
    setCreating(false);
  };

  const submitMessage = async () => {
    if (!draft.trim() || !selectedId || sendMessage.isPending) return;
    const content = draft.trim();
    setDraft('');
    await sendMessage.mutateAsync(content);
  };

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-[220px_1fr]">
      <Card padding="sm" className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-subtle">Conversations</span>
          <Button size="sm" variant="ghost" aria-label="New conversation" onClick={() => setCreating((prev) => !prev)}>
            <Plus className="size-4" aria-hidden />
          </Button>
        </div>

        {creating ? (
          <div className="flex flex-col gap-2 rounded-control border border-border p-2">
            <Input
              autoFocus
              placeholder="Conversation title"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void startConversation();
              }}
            />
            <Button
              size="sm"
              loading={createConversation.isPending}
              disabled={!newTitle.trim()}
              onClick={() => void startConversation()}
            >
              Start
            </Button>
          </div>
        ) : null}

        {conversationsLoading ? (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : !conversations || conversations.length === 0 ? (
          <p className="px-1 py-2 text-xs text-muted">No conversations yet.</p>
        ) : (
          <div className="flex flex-col gap-1">
            {conversations.map((conversation) => (
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
                <span className="text-xs text-subtle">
                  {new Date(conversation.updatedAt).toLocaleString()}
                </span>
              </button>
            ))}
          </div>
        )}
      </Card>

      <Card padding="sm" className="flex min-h-[420px] flex-col gap-3">
        {!selectedId ? (
          <EmptyState
            icon={MessageCircle}
            title="Start a conversation"
            description="Ask the tutor a question about this course to begin."
          />
        ) : (
          <>
            <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-1">
              {messagesLoading ? (
                <div className="flex flex-col gap-2">
                  <Skeleton className="h-12 w-2/3" />
                  <Skeleton className="ml-auto h-12 w-1/2" />
                </div>
              ) : (
                (messages ?? []).map((message) => (
                  <div
                    key={message.id}
                    className={cn(
                      'flex flex-col gap-1',
                      message.role === 'user' ? 'items-end' : 'items-start',
                    )}
                  >
                    <div
                      className={cn(
                        'max-w-[85%] rounded-card px-3.5 py-2.5 text-sm',
                        message.role === 'user'
                          ? 'bg-primary text-primary-fg'
                          : 'bg-surface-hover text-fg',
                      )}
                    >
                      {message.content}
                    </div>
                    {message.role === 'assistant' && message.sources && message.sources.length > 0 ? (
                      <details className="max-w-[85%] text-xs text-muted">
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
                ))
              )}

              {sendMessage.isPending ? (
                <div className="flex items-center gap-2 rounded-card bg-surface-hover px-3.5 py-2.5 text-sm text-muted">
                  <Spinner size="sm" />
                  Thinking…
                </div>
              ) : null}
            </div>

            <div className="flex items-end gap-2 border-t border-border pt-3">
              <Textarea
                rows={2}
                placeholder="Ask a question about this course…"
                value={draft}
                disabled={sendMessage.isPending}
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
