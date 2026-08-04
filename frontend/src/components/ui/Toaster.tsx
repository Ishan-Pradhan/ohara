import { Toaster as SonnerToaster } from 'sonner';

/** Mounted once, near the app root (see App.tsx). Styling maps sonner's
 * built-in variants onto our own tokens instead of its default palette. */
export const Toaster = () => (
  <SonnerToaster
    position="bottom-right"
    toastOptions={{
      classNames: {
        toast:
          'rounded-card! border! border-border! bg-surface! text-fg! shadow-lg! shadow-black/10! font-sans!',
        title: 'font-medium!',
        description: 'text-muted!',
        success: 'data-[type=success]:border-success/30!',
        error: 'data-[type=error]:border-danger/30!',
        actionButton: 'bg-primary! text-primary-fg!',
        cancelButton: 'bg-surface-hover! text-fg!',
      },
    }}
  />
);
