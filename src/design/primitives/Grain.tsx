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
 */
const NOISE =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='160' height='160' filter='url(%23n)'/%3E%3C/svg%3E\")";

export function Grain({ opacity = 0.035, contained = false }: GrainProps) {
  return (
    <div
      aria-hidden="true"
      className={`${contained ? 'absolute' : 'fixed'} inset-0 z-0 pointer-events-none`}
      style={{
        backgroundImage: NOISE,
        backgroundRepeat: 'repeat',
        mixBlendMode: 'overlay',
        opacity,
      }}
    />
  );
}
