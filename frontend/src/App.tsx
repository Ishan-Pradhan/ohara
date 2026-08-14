import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from 'react-router-dom';

import { queryClient } from './lib/queryClient.js';
import { setUnauthenticatedHandler } from './lib/axios.js';
import { isGuestOnlyPath } from './lib/guestPaths.js';
import { router } from './routes.js';
import { Toaster } from './components/ui/Toaster.js';
import { TooltipProvider } from './components/ui/Tooltip.js';
import { CURRENT_USER_KEY } from './features/auth/useAuth.js';

// The axios layer cannot import the router or the cache without a cycle, so it
// is handed a callback instead.
setUnauthenticatedHandler(() => {
  const currentUser = queryClient.getQueryData(CURRENT_USER_KEY);
  if (currentUser) {
    queryClient.clear();
  }
  // A visitor who was never logged in gets a 401 on every guest page
  // (login, register, forgot/reset-password) — that's expected, not a
  // logout, and navigating away here would strip /reset-password's
  // `?token=` before the user ever sees the form.
  if (isGuestOnlyPath(router.state.location.pathname)) return;
  void router.navigate('/login');
});

export const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <RouterProvider router={router} />
      <Toaster />
    </TooltipProvider>
  </QueryClientProvider>
);
