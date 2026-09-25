import React from 'react';
import markColor from '../../assets/brand/gridone-mark-color.svg';
import markReversed from '../../assets/brand/gridone-mark-reversed.svg';
import markBlack from '../../assets/brand/gridone-mark-black.svg';
import markWhite from '../../assets/brand/gridone-mark-white.svg';
import horizontalColor from '../../assets/brand/gridone-lockup-horizontal-color.svg';
import horizontalReversed from '../../assets/brand/gridone-lockup-horizontal-reversed.svg';
import horizontalBlack from '../../assets/brand/gridone-lockup-horizontal-black.svg';
import horizontalWhite from '../../assets/brand/gridone-lockup-horizontal-white.svg';
import stackedColor from '../../assets/brand/gridone-lockup-stacked-color.svg';
import stackedReversed from '../../assets/brand/gridone-lockup-stacked-reversed.svg';
import stackedBlack from '../../assets/brand/gridone-lockup-stacked-black.svg';
import stackedWhite from '../../assets/brand/gridone-lockup-stacked-white.svg';

export type LogoVariant = 'mark' | 'horizontal' | 'stacked';
/**
 * color: ink G, gold corner, for chalk and white grounds.
 * reversed: chalk G, gold corner, on its own ink tile (flush on the ink ground).
 * black / white: one-color, for print and photos. The corner loses its gold.
 */
export type LogoTone = 'color' | 'reversed' | 'black' | 'white';

const SOURCES: Record<LogoVariant, Record<LogoTone, string>> = {
  mark: { color: markColor, reversed: markReversed, black: markBlack, white: markWhite },
  horizontal: { color: horizontalColor, reversed: horizontalReversed, black: horizontalBlack, white: horizontalWhite },
  stacked: { color: stackedColor, reversed: stackedReversed, black: stackedBlack, white: stackedWhite },
};

/** Width over height of each file's viewBox, so the logo keeps its drawing. */
const ASPECT: Record<LogoVariant, number> = {
  mark: 1,
  horizontal: 393.2851311953352 / 104,
  stacked: 215.0995918367347 / 157.92,
};

export interface LogoProps {
  variant?: LogoVariant;
  tone?: LogoTone;
  /** Rendered height in CSS pixels. */
  size?: number;
  className?: string;
}

/**
 * The Corner Square logo. Renders the brand kit's SVG files in
 * src/assets/brand/ unchanged; never redraw it. Its accessible name is always
 * "GridOne". Wrap it in a link when it navigates.
 */
export function Logo({ variant = 'mark', tone = 'color', size = 32, className = '' }: LogoProps) {
  return (
    <img
      src={SOURCES[variant][tone]}
      alt="GridOne"
      aria-label="GridOne"
      width={Math.round(size * ASPECT[variant])}
      height={size}
      draggable={false}
      className={`block shrink-0 select-none ${className}`.trim()}
    />
  );
}
