import React from 'react';
import pattern from '../../assets/brand/gridone-board-pattern.svg';
import patternReversed from '../../assets/brand/gridone-board-pattern-reversed.svg';

export interface SquareOneProps {
  /** `ink` for chalk and white grounds; `reversed` sits flush on the ink ground. */
  tone?: 'ink' | 'reversed';
  /** Rendered size in CSS pixels. */
  size?: number;
  className?: string;
}

/**
 * Square One: the 10 by 10 board with one gold square. The secondary brand
 * pattern for loading and empty states. Decorative, so it is hidden from
 * assistive tech; the surrounding text says what is happening. Never the logo.
 * It fades in once and holds still; reduced motion shows it immediately.
 */
export function SquareOne({ tone = 'ink', size = 96, className = '' }: SquareOneProps) {
  return (
    <img
      data-square-one
      src={tone === 'reversed' ? patternReversed : pattern}
      alt=""
      aria-hidden="true"
      width={size}
      height={size}
      draggable={false}
      className={`g-fade-in block shrink-0 select-none ${className}`.trim()}
    />
  );
}
