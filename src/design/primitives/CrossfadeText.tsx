import React, { useEffect, useRef, useState } from 'react';
import { DUR_SPRING, useReducedMotion } from './motion';

interface CrossfadeTextProps {
  value: string;
  className?: string;
}

/**
 * Stacks the outgoing line over the incoming one so the row height does not jump.
 * The outgoing copy is hidden from the accessible name.
 */
export function CrossfadeText({ value, className = '' }: CrossfadeTextProps) {
  const reduced = useReducedMotion();
  const shown = useRef(value);
  const [frame, setFrame] = useState<{ current: string; outgoing: string | null }>({ current: value, outgoing: null });

  useEffect(() => {
    if (shown.current === value) return;
    const previous = shown.current;
    shown.current = value;
    if (reduced) {
      setFrame({ current: value, outgoing: null });
      return;
    }
    setFrame({ current: value, outgoing: previous });
    const timer = window.setTimeout(() => setFrame({ current: value, outgoing: null }), DUR_SPRING);
    return () => window.clearTimeout(timer);
  }, [reduced, value]);

  return (
    <span className={`crossfade ${className}`.trim()}>
      {frame.outgoing !== null && <span className="crossfade-out" aria-hidden="true">{frame.outgoing}</span>}
      <span className={frame.outgoing !== null ? 'crossfade-in' : undefined}>{frame.current}</span>
    </span>
  );
}
