import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockCreate = vi.fn();
const mockLoggerInfo = vi.fn();
const mockLoggerWarn = vi.fn();

vi.mock('../../src/utils/logger.js', () => ({
  logger: { info: mockLoggerInfo, warn: mockLoggerWarn, error: vi.fn() },
}));

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

const { runAgentTurn, generateJson } = await import('../../src/services/llm.service.js');
const { APIError } = await import('groq-sdk');
const { env } = await import('../../src/config/env.js');

// llm.service.ts always chains .withResponse() on the real SDK's
// APIPromise (to read rate-limit headers off successful responses too, not
// just failed ones) — mockCreate must return something shaped the same way,
// not a plain resolved/rejected Promise.
const mockSuccess = (data: unknown, headers: Headers = new Headers()) => ({
  withResponse: () => Promise.resolve({ data, response: { headers } }),
});
const mockFailure = (err: unknown) => ({
  withResponse: () => Promise.reject(err),
});

describe('runAgentTurn', () => {
  beforeEach(() => {
    mockCreate.mockReset();
    mockLoggerInfo.mockReset();
    mockLoggerWarn.mockReset();
  });

  it('returns text when the model responds without tool_calls', async () => {
    mockCreate.mockReturnValue(
      mockSuccess({
        choices: [{ message: { content: 'Hello', tool_calls: undefined } }],
      }),
    );

    const result = await runAgentTurn([{ role: 'user', content: 'hi' }], []);

    expect(result).toEqual({ type: 'text', content: 'Hello' });
  });

  it('returns tool_calls when the model requests a tool', async () => {
    mockCreate.mockReturnValue(
      mockSuccess({
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
      }),
    );

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
    mockCreate.mockReturnValue(
      mockFailure(
        APIError.generate(429, { error: { message: 'rate limit reached' } }, undefined, new Headers()),
      ),
    );

    await expect(runAgentTurn([{ role: 'user', content: 'hi' }], [])).rejects.toThrow(
      'The AI service has reached its usage limit for now — please try again in a few minutes.',
    );
  });

  it('translates a daily-quota-exhausted error distinctly from a per-minute one', async () => {
    // Real message shape from an actually-exhausted account (2026-08-25).
    mockCreate.mockReturnValue(
      mockFailure(
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
      ),
    );

    await expect(runAgentTurn([{ role: 'user', content: 'hi' }], [])).rejects.toThrow(
      'The AI service has used its full quota for today',
    );
  });

  it('translates a per-minute-too-large error distinctly from a daily one', async () => {
    // Real message shape from a single oversized request (2026-08-25).
    mockCreate.mockReturnValue(
      mockFailure(
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
      ),
    );

    await expect(runAgentTurn([{ role: 'user', content: 'hi' }], [])).rejects.toThrow(
      'The AI service has reached its per-minute usage limit',
    );
  });

  it('translates any other Groq API error into a friendly, user-safe message', async () => {
    // Mirrors a real json_validate_failed 400: the raw body includes
    // internal detail (failed_generation) that must never reach the client.
    mockCreate.mockReturnValue(
      mockFailure(
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
      ),
    );

    await expect(runAgentTurn([{ role: 'user', content: 'hi' }], [])).rejects.toThrow(
      'The AI service could not complete this request — please try again.',
    );
  });

  it('logs rate-limit headers at info level when quota is healthy', async () => {
    const headers = new Headers({
      'x-ratelimit-remaining-tokens': '7000',
      'x-ratelimit-limit-tokens': '8000',
      'x-ratelimit-remaining-requests': '990',
      'x-ratelimit-limit-requests': '1000',
    });
    mockCreate.mockReturnValue(
      mockSuccess({ choices: [{ message: { content: 'Hello', tool_calls: undefined } }] }, headers),
    );

    await runAgentTurn([{ role: 'user', content: 'hi' }], []);

    expect(mockLoggerInfo).toHaveBeenCalledWith(
      expect.objectContaining({ callSite: 'runAgentTurn', remainingTokens: '7000' }),
      'Groq rate-limit headers',
    );
    expect(mockLoggerWarn).not.toHaveBeenCalled();
  });

  it('logs rate-limit headers at warn level when the token quota is running low', async () => {
    // 500/8000 remaining = well under the 20% threshold.
    const headers = new Headers({
      'x-ratelimit-remaining-tokens': '500',
      'x-ratelimit-limit-tokens': '8000',
    });
    mockCreate.mockReturnValue(
      mockSuccess({ choices: [{ message: { content: 'Hello', tool_calls: undefined } }] }, headers),
    );

    await runAgentTurn([{ role: 'user', content: 'hi' }], []);

    expect(mockLoggerWarn).toHaveBeenCalledWith(
      expect.objectContaining({ callSite: 'runAgentTurn', remainingTokens: '500' }),
      'Groq token quota running low',
    );
  });

  it('also logs rate-limit headers from a rate-limit error response, not just successes', async () => {
    const headers = new Headers({ 'x-ratelimit-remaining-tokens': '0', 'x-ratelimit-limit-tokens': '8000' });
    mockCreate.mockReturnValue(
      mockFailure(APIError.generate(429, { error: { message: 'rate limit reached' } }, undefined, headers)),
    );

    await expect(runAgentTurn([{ role: 'user', content: 'hi' }], [])).rejects.toThrow();

    expect(mockLoggerWarn).toHaveBeenCalledWith(
      expect.objectContaining({ callSite: 'runAgentTurn', remainingTokens: '0' }),
      'Groq token quota running low',
    );
  });

  it('does not log or throw when rate-limit headers are absent', async () => {
    mockCreate.mockReturnValue(
      mockSuccess({ choices: [{ message: { content: 'Hello', tool_calls: undefined } }] }, new Headers()),
    );

    await runAgentTurn([{ role: 'user', content: 'hi' }], []);

    expect(mockLoggerInfo).not.toHaveBeenCalled();
    expect(mockLoggerWarn).not.toHaveBeenCalled();
  });
});

describe('model override', () => {
  beforeEach(() => {
    mockCreate.mockReset();
  });

  it('generateJson uses env.GROQ_MODEL by default', async () => {
    mockCreate.mockReturnValue(mockSuccess({ choices: [{ message: { content: '{}' } }] }));

    await generateJson('system', 'user');

    expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({ model: env.GROQ_MODEL }));
  });

  it('generateJson uses an explicitly passed model instead of the default', async () => {
    mockCreate.mockReturnValue(mockSuccess({ choices: [{ message: { content: '{}' } }] }));

    await generateJson('system', 'user', 4096, 'llama-3.1-8b-instant');

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'llama-3.1-8b-instant' }),
    );
  });

  it('runAgentTurn uses an explicitly passed model instead of the default', async () => {
    mockCreate.mockReturnValue(
      mockSuccess({ choices: [{ message: { content: 'hi', tool_calls: undefined } }] }),
    );

    await runAgentTurn([{ role: 'user', content: 'hi' }], [], 'llama-3.1-8b-instant');

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'llama-3.1-8b-instant' }),
    );
  });
});
