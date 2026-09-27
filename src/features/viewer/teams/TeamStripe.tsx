import React from 'react';
import { teamStripeColor } from './teamColors';

/**
 * A decorative team-color mark. Hidden from assistive tech because the team
 * name always sits beside it; renders nothing for an unknown team.
 */
const TeamStripe: React.FC<{ abbr?: string | null; className?: string }> = ({ abbr, className = '' }) => {
  const color = teamStripeColor(abbr);
  if (!color) return null;
  return (
    <span
      aria-hidden="true"
      data-team-stripe={color}
      className={`inline-block h-3 w-1.5 shrink-0 rounded-full ring-1 ring-fg-3/70 ${className}`.trim()}
      style={{ backgroundColor: color }}
    />
  );
};

export default TeamStripe;
