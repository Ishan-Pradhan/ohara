import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockCreate = vi.fn();

vi.mock('groq-sdk', () => ({
  default: vi.fn().mockImplementation(function MockGroq() {
    return { chat: { completions: { create: mockCreate } } };
  }),
}));

const { runAgentTurn } = await import('../../src/services/llm.service.js');

describe('runAgentTurn', () => {
  beforeEach(() => {
    mockCreate.mockReset();
  });

  it('returns text when the model responds without tool_calls', async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: 'Hello', tool_calls: undefined } }],
    });

    const result = await runAgentTurn([{ role: 'user', content: 'hi' }], []);

    expect(result).toEqual({ type: 'text', content: 'Hello' });
  });

  it('returns tool_calls when the model requests a tool', async () => {
    mockCreate.mockResolvedValue({
      choices: [
        {
          message: {
            content: null,
            tool_calls: [
              {
                id: 'call_1',
                type: 'function',
                function: { name: 'search_course_material', arguments: '{"query":"x"}' },
              },
            ],
          },
        },
      ],
    });

    const result = await runAgentTurn(
      [{ role: 'user', content: 'hi' }],
      [{ name: 'search_course_material', description: 'test', parameters: {} }],
    );

    expect(result).toEqual({
      type: 'tool_calls',
      calls: [{ id: 'call_1', name: 'search_course_material', arguments: '{"query":"x"}' }],
    });
  });
});
