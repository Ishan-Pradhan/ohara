import type { ReactNode } from 'react';

import { Badge } from '../ui/Badge.js';
import { MarkdownContent } from './MarkdownContent.js';

interface LessonReaderProps {
  moduleTitle: string;
  title: string;
  content: string;
  keyTopics: string[];
  /** Prev/next lesson navigation, rendered below the content — callers own
   * the actual links since sibling lookup differs per role's data source. */
  footer?: ReactNode;
}

export const LessonReader = ({ moduleTitle, title, content, keyTopics, footer }: LessonReaderProps) => (
  <article className="mx-auto max-w-3xl">
    <p className="text-xs font-semibold uppercase tracking-wide text-subtle">{moduleTitle}</p>
    <h1 className="mt-1 text-2xl font-semibold tracking-tight text-fg">{title}</h1>

    {keyTopics.length > 0 ? (
      <div className="mt-3 flex flex-wrap gap-1.5">
        {keyTopics.map((topic) => (
          <Badge key={topic} variant="primary">
            {topic}
          </Badge>
        ))}
      </div>
    ) : null}

    <div className="mt-6">
      <MarkdownContent content={content} />
    </div>

    {footer ? <div className="mt-10 border-t border-border pt-6">{footer}</div> : null}
  </article>
);
