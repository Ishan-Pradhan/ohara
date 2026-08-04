import type { ReactNode } from 'react';
import * as RadixDialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';

import { cn } from '../../lib/cn.js';

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children?: ReactNode;
  footer?: ReactNode;
}

export const Dialog = ({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
}: DialogProps) => (
  <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
    <RadixDialog.Portal>
      <RadixDialog.Overlay
        className={cn(
          'fixed inset-0 z-50 bg-fg/40 backdrop-blur-[2px]',
          'data-[state=open]:[animation:fade-in_150ms_var(--ease-out)]',
          'data-[state=closed]:[animation:fade-out_150ms_var(--ease-out)]',
        )}
      />
      <RadixDialog.Content
        className={cn(
          'fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2',
          'rounded-card border border-border bg-surface p-6 shadow-xl shadow-black/10',
          'data-[state=open]:[animation:scale-in_180ms_var(--ease-out)]',
          'data-[state=closed]:[animation:scale-out_150ms_var(--ease-out)]',
          'focus:outline-none',
        )}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <RadixDialog.Title className="text-lg font-semibold text-fg">
              {title}
            </RadixDialog.Title>
            {description ? (
              <RadixDialog.Description className="mt-1 text-sm text-muted">
                {description}
              </RadixDialog.Description>
            ) : null}
          </div>
          <RadixDialog.Close asChild>
            <button
              type="button"
              aria-label="Close"
              className="shrink-0 rounded-control p-1 text-subtle transition-colors hover:bg-surface-hover hover:text-fg"
            >
              <X className="size-4.5" aria-hidden />
            </button>
          </RadixDialog.Close>
        </div>

        {children}

        {footer ? <div className="mt-6 flex justify-end gap-3">{footer}</div> : null}
      </RadixDialog.Content>
    </RadixDialog.Portal>
  </RadixDialog.Root>
);

/** For a plain yes/no confirmation, no form body needed. */
interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  loading?: boolean;
  onConfirm: () => void;
}

export const ConfirmDialog = ({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
  loading = false,
  onConfirm,
}: ConfirmDialogProps) => {
  // Imported lazily via prop drilling would create a cycle with Button; instead
  // callers of Dialog compose Button themselves. This wrapper only needs the
  // plain elements to stay dependency-free of Button's own styling choices.
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      footer={
        <>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded-control border border-border px-4 py-2 text-sm font-medium text-fg hover:bg-surface-hover"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={onConfirm}
            className={cn(
              'rounded-control px-4 py-2 text-sm font-medium text-white transition-opacity disabled:opacity-60',
              destructive ? 'bg-danger hover:opacity-90' : 'bg-primary hover:bg-primary-hover',
            )}
          >
            {loading ? 'Please wait…' : confirmLabel}
          </button>
        </>
      }
    />
  );
};
