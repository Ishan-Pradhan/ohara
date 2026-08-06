import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';

const components: Components = {
  h1: ({ children }) => <h2 className="mb-3 mt-8 text-xl font-semibold text-fg first:mt-0">{children}</h2>,
  h2: ({ children }) => <h2 className="mb-3 mt-8 text-xl font-semibold text-fg first:mt-0">{children}</h2>,
  h3: ({ children }) => <h3 className="mb-2 mt-6 text-base font-semibold text-fg">{children}</h3>,
  p: ({ children }) => <p className="mb-4 leading-relaxed text-fg">{children}</p>,
  ul: ({ children }) => <ul className="mb-4 list-disc pl-5 leading-relaxed text-fg">{children}</ul>,
  ol: ({ children }) => <ol className="mb-4 list-decimal pl-5 leading-relaxed text-fg">{children}</ol>,
  li: ({ children }) => <li className="mb-1">{children}</li>,
  strong: ({ children }) => <strong className="font-semibold text-fg">{children}</strong>,
  a: ({ children, href }) => (
    <a href={href} target="_blank" rel="noreferrer" className="text-primary hover:underline">
      {children}
    </a>
  ),
  blockquote: ({ children }) => (
    <blockquote className="mb-4 border-l-2 border-primary/40 pl-4 text-muted italic">{children}</blockquote>
  ),
  hr: () => <hr className="my-6 border-border" />,
  code: ({ className, children }) => {
    // Fenced blocks arrive as <pre><code className="language-x">; inline
    // code has no className — that's the only signal react-markdown gives us
    // to tell them apart here (the wrapping <pre> below handles block layout).
    const isBlock = Boolean(className);
    if (!isBlock) {
      return (
        <code className="rounded-[0.3rem] bg-surface-hover px-1.5 py-0.5 font-mono text-[0.85em] text-fg">
          {children}
        </code>
      );
    }
    return <code className={className}>{children}</code>;
  },
  pre: ({ children }) => (
    <pre className="mb-4 overflow-x-auto rounded-control border border-border bg-surface-hover/60 p-4 font-mono text-sm leading-relaxed text-fg">
      {children}
    </pre>
  ),
  table: ({ children }) => (
    <div className="mb-4 overflow-x-auto rounded-control border border-border">
      <table className="w-full border-collapse text-sm">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-surface-hover">{children}</thead>,
  th: ({ children }) => (
    <th className="border-b border-border px-3 py-2 text-left font-semibold text-fg">{children}</th>
  ),
  td: ({ children }) => <td className="border-b border-border px-3 py-2 text-fg">{children}</td>,
};

interface MarkdownContentProps {
  content: string;
}

export const MarkdownContent = ({ content }: MarkdownContentProps) => (
  <div className="text-[15px]">
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
      {content}
    </ReactMarkdown>
  </div>
);
