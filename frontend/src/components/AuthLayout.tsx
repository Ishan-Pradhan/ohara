import type { ReactNode } from 'react';

import { useInstitutionProfile } from '../features/institution/useInstitution.js';

interface AuthLayoutProps {
  /** Small mono-caps kicker above the heading — what this screen is for. */
  eyebrow: string;
  title: string;
  children: ReactNode;
  footer: ReactNode;
}

const ledgerRules = {
  backgroundImage:
    'linear-gradient(color-mix(in oklch, var(--color-bg) 10%, transparent) 1px, transparent 1px)',
  backgroundSize: '100% 2.75rem',
  maskImage: 'linear-gradient(to bottom, transparent, black 12%, black 88%, transparent)',
};

const glowStyle = {
  backgroundImage:
    'radial-gradient(circle, color-mix(in oklch, var(--color-accent) 22%, transparent), transparent 70%)',
};

const DEFAULT_TAGLINE = 'Your institution, on the record.';

/**
 * Shared frame for every unauthenticated screen. The left spine carries the
 * institution's identity once; individual pages only ever supply an eyebrow,
 * a heading, and their form — never their own background treatment.
 */
export const AuthLayout = ({ eyebrow, title, children, footer }: AuthLayoutProps) => {
  const { data: institution } = useInstitutionProfile();
  const configured = Boolean(institution);
  const name = institution?.name ?? 'Ohara';
  const tagline = configured ? institution?.tagline : DEFAULT_TAGLINE;

  return (
    <main className="grid min-h-dvh md:grid-cols-[26rem_1fr]">
      <aside className="relative hidden flex-col overflow-hidden bg-fg px-12 py-14 text-bg md:flex">
        <div aria-hidden className="pointer-events-none absolute inset-0" style={ledgerRules} />
        <div aria-hidden className="pointer-events-none absolute -left-16 -top-16 size-96" style={glowStyle} />

        <div className="relative my-auto">
          <p className="font-mono text-[0.6875rem] font-medium uppercase tracking-[0.14em] text-accent">
            Welcome to
          </p>
          <h2 className="mt-4 font-display text-[2.5rem] leading-[1.08]">{name}</h2>
          {tagline ? <p className="mt-4 max-w-[26ch] text-sm text-bg/65">{tagline}</p> : null}
        </div>

        {configured ? (
          <p className="relative border-t border-bg/10 pt-5 font-display text-sm italic text-bg/55">
            on Ohara
          </p>
        ) : null}
      </aside>

      <div className="flex items-center justify-center px-6 py-14 sm:px-10">
        <div className="w-full max-w-sm">
          <div className="mb-9 text-center md:hidden">
            <span className="font-display text-2xl italic text-primary">{name}</span>
            {tagline ? <p className="mt-1 text-xs text-muted">{tagline}</p> : null}
          </div>

          <p className="font-mono text-[0.6875rem] font-medium uppercase tracking-[0.14em] text-subtle">
            {eyebrow}
          </p>
          <h1 className="mb-7 mt-2 font-display text-[1.75rem] leading-tight text-fg">{title}</h1>

          {children}

          <p className="mt-8 text-center text-sm text-muted">{footer}</p>
        </div>
      </div>
    </main>
  );
};
