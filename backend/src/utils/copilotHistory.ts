interface HistoryMessage {
  role: 'user' | 'assistant';
  content: string;
}

/** Renders the last few turns of a copilot conversation as plain text for
 * the prompt, so follow-ups ("do I beat them?", "what about last week?")
 * resolve against what was actually said rather than nothing. Empty string
 * (not a section with no content) when there's no prior history, so the
 * caller can drop it from the prompt entirely on a conversation's first turn. */
export const formatCopilotHistory = (messages: HistoryMessage[]): string => {
  if (messages.length === 0) return '';
  const lines = messages.map((m) => `${m.role === 'user' ? 'Question' : 'Answer'}: ${m.content}`);
  return `Recent conversation:\n${lines.join('\n')}`;
};
