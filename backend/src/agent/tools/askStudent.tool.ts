import { z } from 'zod';
import type { AgentTool } from '../../types/agent.types.js';

export const askStudentTool: AgentTool = {
  name: 'ask_student',
  description:
    "Pause and ask the student a clarifying question before continuing — use this when the question is ambiguous or you need more information to give a grounded answer. This ends your turn; the student's next message resumes the conversation.",
  parameters: {
    type: 'object',
    properties: {
      question: { type: 'string', description: 'The clarifying question to ask the student' },
    },
    required: ['question'],
  },
};

export const askStudentArgsSchema = z.object({ question: z.string().min(1) });

// No `execute` function: this tool is control-flow only, handled directly
// by the orchestrator (agent/tutorAgent.ts) — it never reaches the generic
// tool-execution path in agent/tools/index.ts. See that file's comment.
