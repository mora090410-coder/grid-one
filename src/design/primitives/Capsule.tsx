import React, { useId } from 'react';

type Variant = 'primary' | 'quiet' | 'ghost';
type Size = 'md' | 'lg';

const VARIANT: Record<Variant, string> = {
  primary: 'group bg-action text-action-text font-semibold hover:bg-action-hover hover:shadow-[0_10px_24px_-12px_var(--g-action)] motion-safe:hover:-translate-y-0.5 motion-safe:focus-visible:-translate-y-0.5',
  quiet: 'bg-panel border border-hairline text-fg hover:bg-panel-hover',
  ghost: 'bg-transparent text-fg-2 hover:text-fg hover:underline underline-offset-4',
};

const SIZE: Record<Size, string> = {
  md: 'h-11 px-5 text-[15px]',
  lg: 'h-13 px-7 text-[17px]',
};

// The transition list names `scale`, NOT `transform`: Tailwind v4 compiles
// `motion-safe:active:scale-[0.98]` to the independent `scale` property, so a list naming
// `transform` transitions nothing and the press snaps.
const BASE = 'inline-flex items-center justify-center gap-2 rounded-capsule font-ui leading-none select-none transition-[background-color,color,box-shadow,translate,scale] duration-[var(--g-dur-state)] ease-[var(--g-ease-state)] motion-safe:active:translate-y-0 motion-safe:active:scale-[0.98] disabled:opacity-40 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-action focus-visible:ring-offset-2 focus-visible:ring-offset-ground';

export interface CapsuleButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export function CapsuleButton({ variant = 'primary', size = 'md', className = '', type = 'button', children, ...rest }: CapsuleButtonProps) {
  return (
    <button type={type} className={`${BASE} ${VARIANT[variant]} ${SIZE[size]} ${className}`.trim()} {...rest}>
      {children}
      {variant === 'primary' && <span aria-hidden="true" className="motion-safe:transition-[translate] motion-safe:duration-[var(--g-dur-state)] motion-safe:ease-[var(--g-ease-state)] motion-safe:group-hover:translate-x-1 motion-safe:group-focus-visible:translate-x-1">→</span>}
    </button>
  );
}

type Tone = 'neutral' | 'turf' | 'live' | 'cardinal';

const TONE: Record<Tone, string> = {
  neutral: 'border border-hairline text-fg-2',
  /** Settled and success states (Drawn, Published, Paid). Never gold: gold means winner. */
  turf: 'bg-tone-turf/15 text-tone-turf',
  /** Only for an in-progress NFL game. Never for generic emphasis. */
  live: 'bg-tone-live/15 text-tone-live',
  cardinal: 'bg-tone-cardinal/15 text-tone-cardinal',
};

interface CapsuleTagProps {
  children: React.ReactNode;
  tone?: Tone;
  className?: string;
}

export function CapsuleTag({ children, tone = 'neutral', className = '' }: CapsuleTagProps) {
  return (
    <span className={`inline-flex items-center h-6 px-2.5 rounded-capsule font-mono uppercase text-[12px] leading-none tracking-[0.08em] whitespace-nowrap ${TONE[tone]} ${className}`.trim()}>
      {children}
    </span>
  );
}

export interface CapsuleInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  hideLabel?: boolean;
  trailing?: React.ReactNode;
}

export function CapsuleInput({ label, hideLabel = false, trailing, className = '', id, ...rest }: CapsuleInputProps) {
  const autoId = useId();
  const inputId = id ?? `capsule-input-${autoId}`;
  return (
    <div className={`flex flex-col gap-2 ${className}`.trim()}>
      <label htmlFor={inputId} className={hideLabel ? 'sr-only' : 'font-ui text-[14px] text-fg-2'}>{label}</label>
      <div className="flex items-center gap-2">
        <input
          id={inputId}
          className="min-w-0 w-full flex-1 h-12 px-5 rounded-capsule bg-panel border border-hairline text-fg text-[16px] font-ui placeholder:text-fg-3 outline-none transition-[border-color,background-color] duration-[var(--g-dur-state)] ease-[var(--g-ease-state)] focus-visible:border-action focus-visible:bg-panel-hover focus-visible:ring-2 focus-visible:ring-action/40"
          {...rest}
        />
        {trailing}
      </div>
    </div>
  );
}
