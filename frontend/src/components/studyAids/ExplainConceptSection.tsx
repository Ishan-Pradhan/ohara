import { useState } from 'react';
import { HelpCircle, Search } from 'lucide-react';

import { useExplainConcept } from '../../features/studyAids/useStudyAids.js';
import { ApiError } from '../../lib/apiError.js';
import { Card } from '../ui/Card.js';
import { Button } from '../ui/Button.js';
import { Input } from '../ui/Input.js';
import { EmptyState } from '../ui/EmptyState.js';
import { MarkdownContent } from '../course-content/MarkdownContent.js';

interface ExplainConceptSectionProps {
  courseId: string;
  lessonId?: string;
}

export const ExplainConceptSection = ({ courseId, lessonId }: ExplainConceptSectionProps) => {
  const [topic, setTopic] = useState('');
  const explain = useExplainConcept(courseId, lessonId);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim() || explain.isPending) return;
    explain.mutate(topic.trim());
  };

  return (
    <Card padding="sm">
      <form onSubmit={submit} className="flex items-center gap-2">
        <Input
          placeholder={
            lessonId ? 'Ask about a concept from this lesson…' : 'Ask about a concept from this course…'
          }
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          maxLength={300}
        />
        <Button type="submit" loading={explain.isPending} disabled={!topic.trim()}>
          <Search className="size-4" aria-hidden />
          Explain
        </Button>
      </form>

      <div className="mt-4">
        {explain.isError ? (
          <p className="text-sm text-danger">
            {explain.error instanceof ApiError
              ? explain.error.message
              : "Couldn't get an explanation — try again."}
          </p>
        ) : explain.data ? (
          <MarkdownContent content={explain.data} />
        ) : !explain.isPending ? (
          <EmptyState
            icon={HelpCircle}
            title="Ask about anything from the material"
            description="Type a topic or concept you'd like explained in more detail, grounded in the course content."
          />
        ) : null}
      </div>
    </Card>
  );
};
