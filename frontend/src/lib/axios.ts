import axios, {
  type AxiosError,
  type AxiosRequestConfig,
  type AxiosResponse,
} from 'axios';

import { toApiError } from './apiError.js';

/**
 * Same-origin by design: Vite proxies /api in development and nginx does in
 * production, so the backend's httpOnly, sameSite=strict cookies are always
 * first-party. The frontend never reads, stores or attaches a token.
 */
export const API_BASE_URL = '/api/v1';

/**
 * Exported for endpoints the browser navigates to directly rather than
 * fetching through axios — e.g. a PDF opened in an <iframe>/new tab
 * (features/documents/documents.api.ts's documentFileUrl). The cookie is
 * same-origin either way, so no separate auth plumbing is needed there;
 * this constant just keeps the prefix in one place.
 */
export const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

/** The minimum an interceptor needs — keeps the logic testable without axios. */
export interface FailedRequest {
  status: number;
  config: { url?: string };
  alreadyRetried: boolean;
}

export interface RefreshDeps<T> {
  refresh: () => Promise<void>;
  retry: (config: { url?: string }) => Promise<T>;
  onGiveUp: () => void;
}

/**
 * Returns a handler that refreshes the session at most once per burst of 401s.
 *
 * Concurrent failures share a single in-flight refresh promise. Without that
 * guard, a dashboard firing four parallel queries would trigger four refreshes,
 * and the backend rotates the refresh token on every call — so three of them
 * would be invalidated and the user would be bounced to the login page.
 */
export const createRefreshInterceptor = <T>({
  refresh,
  retry,
  onGiveUp,
}: RefreshDeps<T>) => {
  let inFlight: Promise<void> | null = null;

  return async (failed: FailedRequest): Promise<T> => {
    if (failed.status !== 401 || failed.alreadyRetried) {
      throw new Error(`Request to ${failed.config.url} failed`);
    }

    // Only the caller that actually starts the refresh (inFlight was null)
    // reports giving up on it — otherwise a burst of N concurrent 401s
    // calls onGiveUp N times (e.g. N parallel dashboard queries all firing
    // queryClient.clear() + a navigate), once per request instead of once
    // for the whole burst.
    const startedThisRefresh = inFlight === null;
    inFlight ??= refresh().finally(() => {
      inFlight = null;
    });

    try {
      await inFlight;
    } catch (error) {
      if (startedThisRefresh) onGiveUp();
      throw error;
    }

    return retry(failed.config);
  };
};

let onUnauthenticated: () => void = () => {};

/** Wired up once by App, which owns the router and the query cache. */
export const setUnauthenticatedHandler = (handler: () => void): void => {
  onUnauthenticated = handler;
};

type Retryable = AxiosRequestConfig & { _retried?: boolean };

const REFRESH_URL = '/auth/refresh-access-token';

const handle401 = createRefreshInterceptor<AxiosResponse>({
  refresh: async () => {
    await api.post(REFRESH_URL);
  },
  retry: async (config) => api.request(config as AxiosRequestConfig),
  onGiveUp: () => onUnauthenticated(),
});

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const status = error.response?.status ?? 0;
    const config = (error.config ?? {}) as Retryable;

    // A 401 from the refresh endpoint itself means there's no session left
    // to recover — routing it through handle401 would call refresh() again
    // (this exact request), and the single-flight `inFlight` guard would
    // then await a promise whose own resolution depends on this call
    // finishing first: a permanent deadlock, not a rejection. `_retried`
    // doesn't catch this because it's set per-request-config, and the
    // refresh call is a fresh request that's never had it set. Reject
    // immediately instead of ever entering handle401 for this one — the
    // rejection propagates back up through refresh()'s `await`, so
    // handle401's own catch block (which calls onGiveUp) still runs for
    // whichever original request triggered the refresh in the first place.
    // REFRESH_URL is only ever requested from inside refresh() below, so
    // this branch has exactly one caller to unwind back to.
    if (status === 401 && config.url === REFRESH_URL) {
      throw toApiError(status, error.response?.data);
    }

    if (status === 401 && !config._retried) {
      config._retried = true;
      return handle401({ status, config, alreadyRetried: false });
    }

    throw toApiError(status, error.response?.data);
  },
);
