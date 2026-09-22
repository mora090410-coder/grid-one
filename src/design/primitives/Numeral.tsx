import React from 'react';
import { DigitFlow } from './DigitFlow';

type Size = 'sm' | 'md' | 'lg' | 'xl';
const SIZE: Record<Size, string> = {
  sm: 'text-[17px]',
  md: 'text-[28px]',
  lg: 'text-[36px] md:text-[44px]',
  xl: 'text-[52px] md:text-[72px]',
};
const SECONDARY: Record<Size, string> = {
  sm: 'text-[13px]',
  md: 'text-[17px]',
  lg: 'text-[20px] md:text-[24px]',
  xl: 'text-[28px] md:text-[36px]',
};

interface NumeralProps {
  value: string | number;
  secondary?: string;
  size?: Size;
  className?: string;
  /** Full spoken form, e.g. "Kansas City 21". Required when secondary is present. */
  label?: string;
}

/** Tabular mono figure with an optional dimmed secondary segment on the same baseline. */
export function Numeral({ value, secondary, size = 'md', className = '', label }: NumeralProps) {
  return (
    <span
      aria-label={label}
      role={label ? 'img' : undefined}
      className={`inline-flex items-baseline gap-0.5 font-mono tabular-nums leading-none text-fg ${SIZE[size]} ${className}`.trim()}
    >
      <span aria-hidden={label ? 'true' : undefined}><DigitFlow value={value} /></span>
      {secondary ? <span aria-hidden={label ? 'true' : undefined} className={`text-fg-3 ${SECONDARY[size]}`}>{secondary}</span> : null}
    </span>
  );
}
