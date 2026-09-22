import React from 'react';
import { Link } from 'react-router-dom';
import { primaryLink } from './cta';

const arrow = 'motion-safe:transition-[translate] motion-safe:duration-[var(--g-dur-state)] motion-safe:ease-[var(--g-ease-state)] motion-safe:group-hover:translate-x-1 motion-safe:group-focus-visible:translate-x-1';

/** Primary marketing link. The arrow is decorative; the accessible name stays the label. */
export function PrimaryCtaLink({ to, children, className = '' }: { to: string; children: React.ReactNode; className?: string }) {
  return (
    <Link to={to} className={`${primaryLink} ${className}`.trim()}>
      {children}
      <span aria-hidden="true" className={arrow}>→</span>
    </Link>
  );
}
