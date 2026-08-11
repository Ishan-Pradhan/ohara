import { useState } from 'react';
import { MessageSquare, Send } from 'lucide-react';
import { api } from '../../lib/axios.js';
import { toast } from '../../lib/toast.js';
import { Card } from '../../components/ui/Card.js';
import { Button } from '../../components/ui/Button.js';
import { Textarea } from '../../components/ui/Textarea.js';
import { EmptyState } from '../../components/ui/EmptyState.js';

export const AdminCopilotCard = () => {
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!question.trim()) return;
    setLoading(true);
    try {
      const res = await api.post('/admin/copilot/query', { question: question.trim() });
      setAnswer(res.data.data.answer);
    } catch {
      toast.error('Failed to get answer');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <div className="flex items-center gap-2 mb-3">
        <MessageSquare className="size-4 text-primary" aria-hidden />
        <h2 className="text-sm font-semibold">Academic Copilot</h2>
      </div>
      <p className="text-xs text-muted mb-3">Ask questions about your institution's academic data.</p>

      <div className="flex gap-2">
        <Textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="e.g. Which students are at risk? How is the science program performing?"
          rows={2}
          className="flex-1"
        />
        <Button
          onClick={handleSubmit}
          loading={loading}
          disabled={!question.trim()}
          size="sm"
        >
          <Send className="size-4" />
        </Button>
      </div>

      {answer && (
        <div className="mt-3 p-3 rounded-control bg-surface-hover text-sm whitespace-pre-wrap">
          {answer}
        </div>
      )}

      {!answer && !loading && (
        <div className="mt-3">
          <EmptyState
            icon={MessageSquare}
            title="Ask a question"
            description="Try: 'Which courses have the lowest attendance?' or 'How many students are at risk?'"
          />
        </div>
      )}
    </Card>
  );
};
