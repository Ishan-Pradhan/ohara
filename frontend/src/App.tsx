import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from 'react-router-dom';

import { queryClient } from './lib/queryClient.js';
import { setUnauthenticatedHandler } from './lib/axios.js';
import { router } from './routes.js';
import { Toaster } from './components/ui/Toaster.js';
import { TooltipProvider } from './components/ui/Tooltip.js';

// The axios layer cannot import the router or the cache without a cycle, so it
// is handed a callback instead.
setUnauthenticatedHandler(() => {
  queryClient.clear();
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
