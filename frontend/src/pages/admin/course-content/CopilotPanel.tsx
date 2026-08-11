import { useState, useRef, useEffect } from 'react';
import { MessageSquare, Plus, Trash2, Send, Bot, User } from 'lucide-react';

import {
  useCopilotConversations,
  useCopilotConversation,
  useCreateCopilotConversation,
  useSendCopilotMessage,
  useDeleteCopilotConversation,
} from '../../../features/teacherIntelligence/useCopilot.js';
import { toast } from '../../../lib/toast.js';
import { Card } from '../../../components/ui/Card.js';
import { Button } from '../../../components/ui/Button.js';
import { Input } from '../../../components/ui/Input.js';
import { Skeleton } from '../../../components/ui/Skeleton.js';
import { EmptyState } from '../../../components/ui/EmptyState.js';
import { cn } from '../../../lib/cn.js';

interface CopilotPanelProps {
  courseId: string;
}

export const CopilotPanel = ({ courseId }: CopilotPanelProps) => {
  const { data: conversations, isLoading } = useCopilotConversations(courseId);
  const [activeId, setActiveId] = useState<string | null>(null);
  const createConversation = useCreateCopilotConversation(courseId);

  const onNew = async () => {
    try {
      const conv = await createConversation.mutateAsync();
      setActiveId(conv.id);
    } catch {
      toast.error('Could not create conversation');
    }
  };

  if (isLoading) {
    return <Skeleton className="h-96 w-full" />;
  }

  return (
    <div className="flex gap-4" style={{ minHeight: 480 }}>
      {/* Conversation list */}
      <div className="flex w-48 flex-col gap-2">
        <Button size="sm" onClick={onNew} disabled={createConversation.isPending}>
          <Plus className="size-3.5" aria-hidden />
          New chat
        </Button>
        <div className="flex flex-col gap-1 overflow-auto">
          {conversations?.map((c) => (
            <button
              key={c.id}
              onClick={() => setActiveId(c.id)}
              className={cn(
                'flex items-center gap-2 rounded-card px-2 py-1.5 text-left text-sm transition-colors',
                activeId === c.id ? 'bg-surface-hover text-fg' : 'text-muted hover:bg-surface-hover hover:text-fg',
              )}
            >
              <MessageSquare className="size-3.5 shrink-0" aria-hidden />
              <span className="truncate">{c.title}</span>
            </button>
          ))}
          {conversations?.length === 0 && (
            <p className="text-xs text-muted">No conversations yet</p>
          )}
        </div>
      </div>

      {/* Active conversation */}
      <div className="flex-1">
        {activeId ? (
          <ConversationView courseId={courseId} conversationId={activeId} />
        ) : (
          <div className="flex h-full items-center justify-center">
            <EmptyState
              icon={Bot}
              title="AI Copilot"
              description="Ask questions about your class performance. Select a conversation or start a new one."
            />
          </div>
        )}
      </div>
    </div>
  );
};

const ConversationView = ({ courseId, conversationId }: { courseId: string; conversationId: string }) => {
  const { data: conversation, isLoading } = useCopilotConversation(courseId, conversationId);
  const sendMessage = useSendCopilotMessage(courseId);
  const deleteConversation = useDeleteCopilotConversation(courseId);
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [conversation?.messages.length]);

  const onSend = async () => {
    const msg = input.trim();
    if (!msg || sendMessage.isPending) return;
    setInput('');
    try {
      await sendMessage.mutateAsync({ conversationId, message: msg });
    } catch {
      toast.error('Failed to get a response');
    }
  };

  const onDelete = async () => {
    try {
      await deleteConversation.mutateAsync(conversationId);
    } catch {
      toast.error('Could not delete conversation');
    }
  };

  if (isLoading) {
    return <Skeleton className="h-full w-full" />;
  }

  if (!conversation) {
    return null;
  }

  return (
    <Card padding="none" className="flex h-full flex-col overflow-hidden">
      <div className="flex items-center justify-between border-b border-border px-4 py-2">
        <span className="text-sm font-medium">{conversation.title}</span>
        <Button variant="ghost" size="sm" onClick={onDelete}>
          <Trash2 className="size-3.5" aria-hidden />
        </Button>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-auto p-4">
        {conversation.messages.length === 0 && (
          <p className="text-center text-sm text-muted">
            Ask a question about your class to get started.
          </p>
        )}
        <div className="flex flex-col gap-3">
          {conversation.messages.map((msg) => (
            <div
              key={msg.id}
              className={cn(
                'flex gap-2',
                msg.role === 'user' ? 'justify-end' : 'justify-start',
              )}
            >
              {msg.role === 'assistant' && (
                <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Bot className="size-4" aria-hidden />
                </div>
              )}
              <div
                className={cn(
                  'max-w-[80%] rounded-card px-3 py-2 text-sm',
                  msg.role === 'user'
                    ? 'bg-primary text-primary-fg'
                    : 'bg-surface-hover text-fg',
                )}
              >
                {msg.content}
              </div>
              {msg.role === 'user' && (
                <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-muted-fg">
                  <User className="size-4" aria-hidden />
                </div>
              )}
            </div>
          ))}
          {sendMessage.isPending && (
            <div className="flex gap-2">
              <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Bot className="size-4" aria-hidden />
              </div>
              <div className="rounded-card bg-surface-hover px-3 py-2 text-sm text-muted">
                Thinking...
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="border-t border-border p-3">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSend();
          }}
          className="flex gap-2"
        >
          <Input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about your class..."
            className="flex-1"
            disabled={sendMessage.isPending}
          />
          <Button type="submit" size="sm" disabled={!input.trim() || sendMessage.isPending}>
            <Send className="size-3.5" aria-hidden />
          </Button>
        </form>
      </div>
    </Card>
  );
};
