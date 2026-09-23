import React from 'react';

export interface GrainProps {
  /** Layer opacity. Kept very low so it reads as texture, never as noise. */
  opacity?: number;
  /** Clip the grain to a positioned parent. The homepage uses this on the hero only. */
  contained?: boolean;
}

/**
 * Fixed procedural film grain over the whole viewport. Decorative only:
 * `aria-hidden`, `pointer-events-none`, and never focusable, so it cannot be
 * read by assistive tech or intercept a click. Rendered once per page.
 *
 * The texture is an inline SVG `feTurbulence` data URI — no network request,
 * no image asset, and no color of its own, so the palette is untouched.
 *
 * The faintness lives inside the SVG and the overlay blend lives on a
 * `::before` (see `.g-grain` in tokens.css). A blend or opacity on this element
 * itself made accessibility checkers (axe) fold it into the controls above it
 * and report the gold button as dark-on-dark.
 */
const noise = (opacity: number) =>
  `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='160' height='160' filter='url(%23n)' opacity='${Math.min(1, Math.max(0, opacity))}'/%3E%3C/svg%3E")`;

export function Grain({ opacity = 0.035, contained = false }: GrainProps) {
  return (
    <div
      aria-hidden="true"
      className={`g-grain ${contained ? 'absolute' : 'fixed'} inset-0 pointer-events-none`}
      style={{ '--g-grain-image': noise(opacity) } as React.CSSProperties}
    />
  );
}
