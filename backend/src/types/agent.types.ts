export interface AgentToolCall {
  id: string;
  name: string;
  /** Raw JSON string, exactly as the model returned it — Zod-parsed by the
   * caller (the orchestrator), never trusted here. */
  arguments: string;
}

export type AgentMessage =
  | { role: 'system'; content: string }
  | { role: 'user'; content: string }
  | { role: 'assistant'; content: string | null; toolCalls?: AgentToolCall[] }
  | { role: 'tool'; toolCallId: string; content: string };

export interface AgentTool {
  name: string;
  description: string;
  /** JSON Schema for the tool's arguments — passed to Groq as-is. */
  parameters: Record<string, unknown>;
}

export type AgentTurnResult =
  | { type: 'text'; content: string }
  | { type: 'tool_calls'; calls: AgentToolCall[] };
