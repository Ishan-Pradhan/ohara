import { describe, it, expect, vi } from 'vitest';
import type { AxiosRequestConfig } from 'axios';

import { api, createRefreshInterceptor, setUnauthenticatedHandler } from '../src/lib/axios.js';

/** Rejects if `promise` doesn't settle within `ms` — the only way to observe
 * a hang (a real deadlock never rejects on its own, so a plain `await` would
 * hang the test runner too). */
const withTimeout = <T>(promise: Promise<T>, ms: number): Promise<T> =>
  Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Timed out after ${ms}ms — likely deadlocked`)), ms),
    ),
  ]);

const axiosStyleError = (config: AxiosRequestConfig, status: number) => ({
  isAxiosError: true,
  config,
  response: { status, data: {} },
  message: `Request failed with status ${status}`,
});

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
    expect(onGiveUp).toHaveBeenCalledTimes(1);
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

describe('api response interceptor (end-to-end, real axios chain)', () => {
  /** Every request 401s, including the refresh endpoint itself — simulates
   * a genuinely unauthenticated caller (no session, no valid refresh
   * cookie): the exact case for both "stuck loading on / when logged out"
   * and "sign out doesn't redirect to login". */
  const alwaysUnauthenticatedAdapter = async (config: AxiosRequestConfig) => {
    throw axiosStyleError(config, 401);
  };

  it('rejects (does not hang) when the refresh endpoint itself 401s', async () => {
    const onUnauthenticated = vi.fn();
    setUnauthenticatedHandler(onUnauthenticated);
    api.defaults.adapter = alwaysUnauthenticatedAdapter;

    await expect(
      withTimeout(api.get('/auth/current-user'), 1000),
    ).rejects.toThrow();

    expect(onUnauthenticated).toHaveBeenCalledTimes(1);
  });

  it('rejects every request in a concurrent burst exactly once each, without hanging', async () => {
    // The realistic trigger: a dashboard firing several parallel queries
    // (AppShell + page content) all 401 at once, with no valid session to
    // recover via refresh.
    const onUnauthenticated = vi.fn();
    setUnauthenticatedHandler(onUnauthenticated);
    api.defaults.adapter = alwaysUnauthenticatedAdapter;

    const results = await withTimeout(
      Promise.allSettled([
        api.get('/auth/current-user'),
        api.get('/institution-profile'),
        api.get('/admin/stats'),
      ]),
      1000,
    );

    expect(results.every((r) => r.status === 'rejected')).toBe(true);
    expect(onUnauthenticated).toHaveBeenCalledTimes(1);
  });
});
