import { QueryClient } from '@tanstack/react-query';

import { ApiError } from './apiError.js';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        // A 401 is answered by the refresh interceptor, not by retrying, and
        // no 4xx becomes correct on a second attempt.
        if (error instanceof ApiError && error.status < 500) return false;
        return failureCount < 2;
      },
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
  },
});
