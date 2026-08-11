import type { ReactNode } from 'react';
import * as RadixTabs from '@radix-ui/react-tabs';

import { cn } from '../../lib/cn.js';

export const Tabs = RadixTabs.Root;

export const TabsList = ({ children }: { children: ReactNode }) => (
  <RadixTabs.List className="inline-flex gap-1 overflow-x-auto rounded-control bg-surface-hover p-1 scrollbar-none">
    {children}
  </RadixTabs.List>
);

export const TabsTrigger = ({ value, children }: { value: string; children: ReactNode }) => (
  <RadixTabs.Trigger
    value={value}
    className={cn(
      'inline-flex items-center gap-1.5 rounded-[0.4rem] px-3.5 py-1.5 text-sm font-medium text-muted transition-colors',
      'data-[state=active]:bg-surface data-[state=active]:text-fg data-[state=active]:shadow-sm',
      'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
    )}
  >
    {children}
  </RadixTabs.Trigger>
);

export const TabsContent = ({ value, children }: { value: string; children: ReactNode }) => (
  <RadixTabs.Content value={value} className="mt-4 focus-visible:outline-none">
    {children}
  </RadixTabs.Content>
);
