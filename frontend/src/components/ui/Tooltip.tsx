import type { ReactNode } from 'react';
import * as RadixTooltip from '@radix-ui/react-tooltip';

import { cn } from '../../lib/cn.js';

export const TooltipProvider = RadixTooltip.Provider;

interface TooltipProps {
  content: ReactNode;
  children: ReactNode;
}

export const Tooltip = ({ content, children }: TooltipProps) => (
  <RadixTooltip.Root delayDuration={300}>
    <RadixTooltip.Trigger asChild>{children}</RadixTooltip.Trigger>
    <RadixTooltip.Portal>
      <RadixTooltip.Content
        sideOffset={6}
        className={cn(
          'z-50 rounded-control bg-fg px-2.5 py-1.5 text-xs font-medium text-bg shadow-md',
          'data-[state=delayed-open]:[animation:fade-in_120ms_var(--ease-out)]',
        )}
      >
        {content}
        <RadixTooltip.Arrow className="fill-fg" />
      </RadixTooltip.Content>
    </RadixTooltip.Portal>
  </RadixTooltip.Root>
);
