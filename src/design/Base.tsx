import React from 'react';

export type BaseKind = 'dark' | 'cream';

interface BaseProps {
  kind: BaseKind;
  className?: string;
  theme?: 'liquid';
  children: React.ReactNode;
}

/** Root wrapper for a redesigned surface. Sets the base so semantic tokens resolve. */
export function Base({ kind, theme, className = '', children }: BaseProps) {
  return (
    <div data-base={kind} data-g1-theme={theme} className={`min-h-[100dvh] bg-ground text-fg font-ui antialiased ${className}`.trim()}>
      {children}
    </div>
  );
}
