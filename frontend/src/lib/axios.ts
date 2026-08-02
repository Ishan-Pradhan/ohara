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
export const api = axios.create({
  baseURL: '/api/v1',
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

    inFlight ??= refresh().finally(() => {
      inFlight = null;
    });

    try {
      await inFlight;
    } catch (error) {
      onGiveUp();
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

const handle401 = createRefreshInterceptor<AxiosResponse>({
  refresh: async () => {
    await api.post('/auth/refresh-access-token');
  },
  retry: async (config) => api.request(config as AxiosRequestConfig),
  onGiveUp: () => onUnauthenticated(),
});

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const status = error.response?.status ?? 0;
    const config = (error.config ?? {}) as Retryable;

    // _retried is set before retrying, so a refresh that itself 401s falls
    // through to the error path instead of recursing.
    if (status === 401 && !config._retried) {
      config._retried = true;
      return handle401({ status, config, alreadyRetried: false });
    }

    throw toApiError(status, error.response?.data);
  },
);
