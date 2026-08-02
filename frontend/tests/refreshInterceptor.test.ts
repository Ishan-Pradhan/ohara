import { describe, it, expect, vi } from 'vitest';

import { createRefreshInterceptor } from '../src/lib/axios.js';

const failed = (overrides: Partial<{ status: number; alreadyRetried: boolean; url: string }> = {}) => ({
  status: overrides.status ?? 401,
  config: { url: overrides.url ?? '/a' },
  alreadyRetried: overrides.alreadyRetried ?? false,
});

describe('createRefreshInterceptor', () => {
  it('issues exactly one refresh for concurrent 401s', async () => {
    const refresh = vi.fn(async () => {});
    const retry = vi.fn(async () => 'retried');
    const onGiveUp = vi.fn();

    const handle = createRefreshInterceptor({ refresh, retry, onGiveUp });

    const results = await Promise.all([
      handle(failed({ url: '/a' })),
      handle(failed({ url: '/b' })),
      handle(failed({ url: '/c' })),
    ]);

    expect(refresh).toHaveBeenCalledTimes(1);
    expect(retry).toHaveBeenCalledTimes(3);
    expect(results).toEqual(['retried', 'retried', 'retried']);
    expect(onGiveUp).not.toHaveBeenCalled();
  });

  it('gives up when the refresh itself fails', async () => {
    const refresh = vi.fn(async () => {
      throw new Error('refresh failed');
    });
    const retry = vi.fn(async () => 'retried');
    const onGiveUp = vi.fn();

    const handle = createRefreshInterceptor({ refresh, retry, onGiveUp });

    await expect(handle(failed())).rejects.toThrow('refresh failed');
    expect(onGiveUp).toHaveBeenCalledTimes(1);
    expect(retry).not.toHaveBeenCalled();
  });

  it('gives up once for a whole burst when the refresh fails', async () => {
    const refresh = vi.fn(async () => {
      throw new Error('refresh failed');
    });
    const onGiveUp = vi.fn();
    const handle = createRefreshInterceptor({
      refresh,
      retry: vi.fn(async () => 'retried'),
      onGiveUp,
    });

    await Promise.allSettled([handle(failed({ url: '/a' })), handle(failed({ url: '/b' }))]);

    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('does not retry a request that already retried once', async () => {
    const refresh = vi.fn(async () => {});
    const retry = vi.fn(async () => 'retried');

    const handle = createRefreshInterceptor({
      refresh,
      retry,
      onGiveUp: vi.fn(),
    });

    await expect(handle(failed({ alreadyRetried: true }))).rejects.toThrow();
    expect(refresh).not.toHaveBeenCalled();
  });

  it('passes through non-401 failures untouched', async () => {
    const refresh = vi.fn(async () => {});

    const handle = createRefreshInterceptor({
      refresh,
      retry: vi.fn(async () => 'retried'),
      onGiveUp: vi.fn(),
    });

    await expect(handle(failed({ status: 500 }))).rejects.toThrow();
    expect(refresh).not.toHaveBeenCalled();
  });

  it('allows a fresh refresh after the first cycle settles', async () => {
    const refresh = vi.fn(async () => {});
    const handle = createRefreshInterceptor({
      refresh,
      retry: vi.fn(async () => 'retried'),
      onGiveUp: vi.fn(),
    });

    await handle(failed({ url: '/a' }));
    await handle(failed({ url: '/b' }));

    expect(refresh).toHaveBeenCalledTimes(2);
  });
});
