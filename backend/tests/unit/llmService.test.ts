import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockCreate = vi.fn();

vi.mock('groq-sdk', async (importOriginal) => {
  // Only the client constructor is mocked — APIError/RateLimitError must
  // stay the real classes so llm.service.ts's `instanceof` checks work.
  const actual = await importOriginal<typeof import('groq-sdk')>();
  return {
    ...actual,
    default: vi.fn().mockImplementation(function MockGroq() {
      return { chat: { completions: { create: mockCreate } } };
    }),
  };
});

const { runAgentTurn } = await import('../../src/services/llm.service.js');
const { APIError } = await import('groq-sdk');

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

  it('translates a Groq rate-limit error into a friendly, user-safe message', async () => {
    mockCreate.mockRejectedValue(
      APIError.generate(429, { error: { message: 'rate limit reached' } }, undefined, new Headers()),
    );

    await expect(runAgentTurn([{ role: 'user', content: 'hi' }], [])).rejects.toThrow(
      'The AI service has reached its usage limit for now — please try again in a few minutes.',
    );
  });

  it('translates a daily-quota-exhausted error distinctly from a per-minute one', async () => {
    // Real message shape from an actually-exhausted account (2026-08-25).
    mockCreate.mockRejectedValue(
      APIError.generate(
        429,
        {
          error: {
            message:
              'Rate limit reached for model `openai/gpt-oss-120b` in organization `org_x` service tier `on_demand` on tokens per day (TPD): Limit 200000, Used 194236, Requested 7579. Please try again in 13m4.08s.',
            type: 'tokens',
            code: 'rate_limit_exceeded',
          },
        },
        undefined,
        new Headers(),
      ),
    );

    await expect(runAgentTurn([{ role: 'user', content: 'hi' }], [])).rejects.toThrow(
      'The AI service has used its full quota for today',
    );
  });

  it('translates a per-minute-too-large error distinctly from a daily one', async () => {
    // Real message shape from a single oversized request (2026-08-25).
    mockCreate.mockRejectedValue(
      APIError.generate(
        413,
        {
          error: {
            message:
              'Request too large for model `openai/gpt-oss-120b` in organization `org_x` service tier `on_demand` on tokens per minute (TPM): Limit 8000, Requested 14518, please reduce your message size and try again.',
            type: 'tokens',
            code: 'rate_limit_exceeded',
          },
        },
        undefined,
        new Headers(),
      ),
    );

    await expect(runAgentTurn([{ role: 'user', content: 'hi' }], [])).rejects.toThrow(
      'The AI service has reached its per-minute usage limit',
    );
  });

  it('translates any other Groq API error into a friendly, user-safe message', async () => {
    // Mirrors a real json_validate_failed 400: the raw body includes
    // internal detail (failed_generation) that must never reach the client.
    mockCreate.mockRejectedValue(
      APIError.generate(
        400,
        {
          error: {
            message: 'Failed to generate JSON. Please adjust your prompt.',
            code: 'json_validate_failed',
            failed_generation: 'max completion tokens reached before generating a valid document',
          },
        },
        undefined,
        new Headers(),
      ),
    );

    await expect(runAgentTurn([{ role: 'user', content: 'hi' }], [])).rejects.toThrow(
      'The AI service could not complete this request — please try again.',
    );
  });
});
