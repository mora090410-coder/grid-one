import React from 'react';
import { Link } from 'react-router-dom';
import { primaryLink } from './cta';
import { track } from '../../instrumentation/track';

const arrow = 'motion-safe:transition-[translate] motion-safe:duration-[var(--g-dur-state)] motion-safe:ease-[var(--g-ease-state)] motion-safe:group-hover:translate-x-1 motion-safe:group-focus-visible:translate-x-1';

/**
 * Primary marketing link. The arrow is decorative; the accessible name stays the label.
 * `trackCreate` records the homepage primary action; other pages leave it off.
 */
export function PrimaryCtaLink({ to, children, className = '', trackCreate = false }: { to: string; children: React.ReactNode; className?: string; trackCreate?: boolean }) {
  const onClick = trackCreate ? () => track({ name: 'homepage_primary_action', action: 'create_board', surface: 'homepage' }) : undefined;
  return (
    <Link to={to} className={`${primaryLink} ${className}`.trim()} onClick={onClick}>
      {children}
      <span aria-hidden="true" className={arrow}>→</span>
    </Link>
  );
}
